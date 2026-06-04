<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
const { t } = useI18n();
const { safeInterval, delay, clearAll, speed, isAborted } = useVizTimers();

interface Worker {
  id: number;
  state: 'active' | 'waiting' | 'done';
  permitIndex: number;
  remainingMs: number;
}

const MAX_PERMITS = ref(3);
const workers = ref<Worker[]>([]);
const message = ref(t('Click "Acquire" to spawn a worker that claims a permit', '点击"获取"生成一个申请许可的工作线程'));
let nextId = 1;
let presetRunning = false;

const activeWorkers = computed(() =>
  workers.value.filter((w) => w.state === 'active'),
);
const waitingWorkers = computed(() =>
  workers.value.filter((w) => w.state === 'waiting'),
);
const availablePermits = computed(
  () => MAX_PERMITS.value - activeWorkers.value.length,
);

const permits = computed(() => {
  const slots: { taken: boolean; workerId: number | null }[] = [];
  for (let i = 0; i < MAX_PERMITS.value; i++) {
    const occupant = activeWorkers.value.find((w) => w.permitIndex === i);
    slots.push({
      taken: !!occupant,
      workerId: occupant ? occupant.id : null,
    });
  }
  return slots;
});

function findFreePermit(): number {
  for (let i = 0; i < MAX_PERMITS.value; i++) {
    if (!activeWorkers.value.some((w) => w.permitIndex === i)) return i;
  }
  return -1;
}

function tryPromoteWaiting() {
  const slot = findFreePermit();
  if (slot === -1) return;
  const next = waitingWorkers.value[0];
  if (!next) return;
  next.state = 'active';
  next.permitIndex = slot;
  next.remainingMs = randomDuration();
  message.value = t(`Worker #${next.id} acquired permit ${slot + 1} from queue`, `工作线程 #${next.id} 从队列获取了许可 ${slot + 1}`);
  startWorkerTimer(next);
}

function randomDuration(): number {
  return Math.floor(Math.random() * 2000) + 1000;
}

function startWorkerTimer(w: Worker) {
  const tick = 100;
  const timer = safeInterval(() => {
    const target = workers.value.find((x) => x.id === w.id);
    if (!target || target.state !== 'active') {
      clearInterval(timer);
      return;
    }
    target.remainingMs = Math.max(0, target.remainingMs - tick);
    if (target.remainingMs <= 0) {
      clearInterval(timer);
      releaseWorker(target);
    }
  }, tick);
}

function releaseWorker(w: Worker) {
  message.value = t(`Worker #${w.id} released permit ${w.permitIndex + 1}`, `工作线程 #${w.id} 释放了许可 ${w.permitIndex + 1}`);
  w.state = 'done';
  workers.value = workers.value.filter((x) => x.id !== w.id);
  tryPromoteWaiting();
}

function acquire() {
  const id = nextId++;
  const slot = findFreePermit();
  if (slot !== -1) {
    const w: Worker = {
      id,
      state: 'active',
      permitIndex: slot,
      remainingMs: randomDuration(),
    };
    workers.value.push(w);
    message.value = t(`Worker #${id} acquired permit ${slot + 1}`, `工作线程 #${id} 获取了许可 ${slot + 1}`);
    startWorkerTimer(w);
  } else {
    const w: Worker = {
      id,
      state: 'waiting',
      permitIndex: -1,
      remainingMs: 0,
    };
    workers.value.push(w);
    message.value = t(`No permits available — Worker #${id} is waiting in queue`, `无可用许可 — 工作线程 #${id} 正在队列中等待`);
  }
}

function reset() {
  clearAll();
  presetRunning = false;
  workers.value = [];
  nextId = 1;
  message.value = t('Reset — all workers cleared', '已重置 — 所有工作线程已清除');
}

function permitColor(taken: boolean): string {
  return taken ? 'var(--viz-danger)' : 'var(--viz-success)';
}

function progressPercent(w: Worker): number {
  const total = 3000;
  return Math.max(0, Math.min(100, ((total - w.remainingMs) / total) * 100));
}

/* ---------- Preset scenarios ---------- */

async function presetSaturation() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  MAX_PERMITS.value = 3;

  message.value = t(
    'Full saturation: all permits claimed, new workers queue. This is PostgreSQL\'s max_connections (default 100) — connection 101 waits in the pg_stat_activity queue until one finishes.',
    '完全饱和：所有许可已占用，新工作线程排队。这就是 PostgreSQL 的 max_connections（默认 100）— 第 101 个连接在 pg_stat_activity 队列中等待直到有连接释放。',
  );

  for (let i = 0; i < MAX_PERMITS.value; i++) {
    acquire();
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }

  await delay(600);
  if (!presetRunning || isAborted()) return;

  acquire();
  await delay(400);
  if (!presetRunning || isAborted()) return;

  acquire();
  await delay(1500);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'Workers queued. In Java, Semaphore.tryAcquire(timeout) lets callers give up after waiting too long. Go\'s semaphore in sema.go uses a treap-based wait queue for O(log n) priority ordering.',
    '工作线程已排队。Java 中 Semaphore.tryAcquire(timeout) 允许调用者等待超时后放弃。Go 的 sema.go 使用基于 treap 的等待队列实现 O(log n) 优先级排序。',
  );

  presetRunning = false;
}

async function presetQueueDrain() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  MAX_PERMITS.value = 3;

  message.value = t(
    'Queue drain: as active workers complete, queued workers get promoted. This is how thread pool executors (Java ThreadPoolExecutor, .NET ThreadPool) manage bounded concurrency — the work queue absorbs bursts.',
    '队列排空：当活跃工作线程完成时，排队的工作线程被提升。这就是线程池执行器（Java ThreadPoolExecutor、.NET ThreadPool）管理有界并发的方式 — 工作队列吸收突发流量。',
  );

  for (let i = 0; i < MAX_PERMITS.value; i++) {
    acquire();
    await delay(300);
    if (!presetRunning || isAborted()) return;
  }

  await delay(400);
  if (!presetRunning || isAborted()) return;

  for (let i = 0; i < 3; i++) {
    acquire();
    await delay(300);
    if (!presetRunning || isAborted()) return;
  }

  await delay(6000);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'All queued workers eventually got permits. If drain rate < arrival rate, the queue grows unbounded — that\'s why Nginx has worker_connections and Java has LinkedBlockingQueue(capacity).',
    '所有排队的工作线程最终都获得了许可。如果排空速率 < 到达速率，队列将无限增长 — 这就是为什么 Nginx 有 worker_connections，Java 有 LinkedBlockingQueue(capacity)。',
  );

  presetRunning = false;
}

async function presetMutex() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  MAX_PERMITS.value = 1;

  message.value = t(
    'Binary semaphore = mutex: with 1 permit, only one worker runs at a time. Dijkstra invented P()/V() in 1965 for THE OS. Today: Go sync.Mutex, POSIX pthread_mutex, Java ReentrantLock — all are semaphore(1).',
    '二元信号量 = 互斥锁：只有 1 个许可时，同一时间只有一个工作线程运行。Dijkstra 在 1965 年为 THE OS 发明了 P()/V()。如今：Go sync.Mutex、POSIX pthread_mutex、Java ReentrantLock — 都是 semaphore(1)。',
  );

  await delay(800);
  if (!presetRunning || isAborted()) return;

  acquire();
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  acquire();
  await delay(4000);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'The second worker had to wait — mutual exclusion enforced. Binary semaphores are the foundation of all locking primitives in modern operating systems.',
    '第二个工作线程必须等待 — 互斥排他性得到保证。二元信号量是现代操作系统中所有锁原语的基础。',
  );

  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Semaphore', '交互式 Semaphore') }}</div>

    <!-- Stats bar -->
    <div class="sem-stats">
      <span class="sem-stat">
        {{ t('Active:', '活跃：') }} <strong>{{ activeWorkers.length }}</strong>
      </span>
      <span class="sem-stat">
        {{ t('Waiting:', '等待：') }} <strong>{{ waitingWorkers.length }}</strong>
      </span>
      <span class="sem-stat sem-stat--permits">
        {{ t('Available:', '可用：') }} <strong>{{ availablePermits }}/{{ MAX_PERMITS }}</strong>
      </span>
    </div>

    <!-- SVG visualization -->
    <div class="sem-canvas">
      <svg
        :viewBox="`0 0 400 ${180 + Math.max(0, waitingWorkers.length - 1) * 34}`"
        class="sem-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Semaphore box -->
        <rect
          x="120" y="10"
          width="160" height="50"
          rx="8"
          fill="var(--vp-c-bg)"
          stroke="var(--viz-border)"
          stroke-width="1.5"
        />
        <text
          x="200" y="28"
          text-anchor="middle"
          class="sem-svg-label"
        >{{ t('Semaphore', 'Semaphore') }} ({{ MAX_PERMITS }})</text>

        <!-- Permit circles -->
        <g v-for="(p, i) in permits" :key="'p' + i">
          <circle
            :cx="200 + (i - (MAX_PERMITS - 1) / 2) * 36"
            cy="46"
            r="10"
            :fill="permitColor(p.taken)"
            :stroke="p.taken ? 'var(--viz-danger)' : 'var(--viz-success)'"
            stroke-width="1.5"
            :class="{ 'sem-permit-pulse': p.taken }"
          />
          <text
            v-if="p.workerId"
            :x="200 + (i - (MAX_PERMITS - 1) / 2) * 36"
            cy="50"
            text-anchor="middle"
            class="sem-svg-id"
          >#{{ p.workerId }}</text>
        </g>

        <!-- Active workers area -->
        <text
          x="200" y="86"
          text-anchor="middle"
          class="sem-svg-section"
        >{{ t('Active Workers', '活跃工作线程') }}</text>

        <g v-for="(w, i) in activeWorkers" :key="'a' + w.id">
          <rect
            :x="200 + (i - (activeWorkers.length - 1) / 2) * 80 - 32"
            y="94"
            width="64" height="36"
            rx="6"
            fill="var(--vp-c-bg)"
            stroke="var(--viz-primary)"
            stroke-width="1.5"
            class="sem-worker-box"
          />
          <text
            :x="200 + (i - (activeWorkers.length - 1) / 2) * 80"
            y="109"
            text-anchor="middle"
            class="sem-svg-worker"
          >#{{ w.id }}</text>
          <!-- progress bar background -->
          <rect
            :x="200 + (i - (activeWorkers.length - 1) / 2) * 80 - 24"
            y="116"
            width="48" height="4"
            rx="2"
            fill="var(--viz-cell-empty)"
          />
          <!-- progress bar fill -->
          <rect
            :x="200 + (i - (activeWorkers.length - 1) / 2) * 80 - 24"
            y="116"
            :width="48 * progressPercent(w) / 100"
            height="4"
            rx="2"
            fill="var(--viz-primary)"
          />
        </g>

        <text
          v-if="activeWorkers.length === 0"
          x="200" y="116"
          text-anchor="middle"
          class="sem-svg-empty"
        >{{ t('none', '无') }}</text>

        <!-- Waiting queue area -->
        <line
          x1="40" :y1="142"
          x2="360" :y2="142"
          stroke="var(--viz-border)"
          stroke-width="1"
          stroke-dasharray="4 3"
        />
        <text
          x="200" :y="160"
          text-anchor="middle"
          class="sem-svg-section"
        >{{ t('Waiting Queue', '等待队列') }}</text>

        <g v-for="(w, i) in waitingWorkers" :key="'w' + w.id">
          <rect
            :x="148"
            :y="168 + i * 34"
            width="104" height="28"
            rx="6"
            fill="var(--vp-c-bg)"
            stroke="var(--viz-warning)"
            stroke-width="1.5"
            stroke-dasharray="4 2"
            class="sem-waiting-box"
          />
          <text
            x="200"
            :y="186 + i * 34"
            text-anchor="middle"
            class="sem-svg-worker sem-svg-waiting"
          >#{{ w.id }} {{ t('waiting...', '等待中...') }}</text>
        </g>

        <text
          v-if="waitingWorkers.length === 0"
          x="200" :y="182"
          text-anchor="middle"
          class="sem-svg-empty"
        >{{ t('empty', '空') }}</text>
      </svg>
    </div>

    <!-- Controls -->
    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="acquire">
        {{ t('Acquire', '获取') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">
        {{ t('Reset', '重置') }}
      </button>
      <label class="sem-permit-label">
        <span class="viz-label">{{ t('Max permits', '最大许可数') }}</span>
        <select v-model.number="MAX_PERMITS" class="sem-select" @change="reset">
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
          <option :value="5">5</option>
        </select>
      </label>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetSaturation">{{ t('Saturation', '饱和') }}</button>
      <button class="viz-btn" @click="presetQueueDrain">{{ t('Queue Drain', '队列排空') }}</button>
      <button class="viz-btn" @click="presetMutex">{{ t('Mutex (1 Permit)', '互斥锁') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.sem-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.sem-stat {
  font-size: 0.75rem;
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.sem-stat--permits {
  color: var(--viz-success);
}

.sem-canvas {
  display: flex;
  justify-content: center;
  padding: 0.25rem 0;
}

.sem-svg {
  width: 100%;
  max-width: 420px;
  height: auto;
}

.sem-svg-label {
  font-size: 11px;
  font-weight: 600;
  fill: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.sem-svg-section {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  fill: var(--viz-muted);
}

.sem-svg-id {
  font-size: 8px;
  font-weight: 700;
  fill: #fff;
  font-family: var(--vp-font-family-mono);
}

.sem-svg-worker {
  font-size: 10px;
  font-weight: 600;
  fill: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.sem-svg-waiting {
  fill: var(--viz-warning);
}

.sem-svg-empty {
  font-size: 10px;
  fill: var(--viz-muted);
  font-style: italic;
}

.sem-worker-box {
  animation: viz-slide-in 0.2s ease;
}

.sem-waiting-box {
  animation: viz-slide-in 0.2s ease;
}

.sem-permit-pulse {
  animation: sem-pulse 1.5s ease-in-out infinite;
}

.sem-permit-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: auto;
}

.sem-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--viz-text);
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  cursor: pointer;
}

@keyframes sem-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@media (max-width: 640px) {
  .sem-stats {
    gap: 0.5rem;
  }

  .sem-stat {
    font-size: 0.7rem;
  }

  .sem-svg {
    max-width: 100%;
  }

  .sem-permit-label {
    margin-left: 0;
    margin-top: 0.25rem;
  }
}
</style>
