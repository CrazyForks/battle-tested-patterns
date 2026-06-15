<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeInterval, safeTimeout, clearAll, speed } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface Task {
  id: number;
  progress: number;
}

interface Worker {
  name: string;
  color: string;
  queue: Task[];
  stolen: number;
}

let nextTaskId = 1;

const workers = ref<Worker[]>([
  { name: 'W1', color: 'var(--viz-primary)', queue: [], stolen: 0 },
  { name: 'W2', color: 'var(--viz-success)', queue: [], stolen: 0 },
  { name: 'W3', color: 'var(--viz-warning)', queue: [], stolen: 0 },
]);

const message = ref(
  t(
    'Add tasks to workers, then start — idle workers steal from busy ones. Pick a scenario below.',
    '向工作线程添加任务，然后开始 — 空闲线程从繁忙线程窃取任务。选择下方场景。',
  ),
);
const running = ref(false);
const stealHighlight = ref('');
let presetRunning = false;

const history = useVizHistory<Worker[]>(workers.value, {
  getMessage: () => message.value,
  onRestore(state, msg) {
    presetRunning = false;
    workers.value = state;
    stealHighlight.value = '';
    running.value = false;
    if (msg !== undefined) message.value = msg;
  },
});

function addTasks(workerIdx: number, count = 4) {
  const w = workers.value[workerIdx];
  for (let i = 0; i < count; i++) {
    w.queue.push({ id: nextTaskId++, progress: 0 });
  }
  message.value = t(
    `Added ${count} tasks to ${w.name} (queue: ${w.queue.length}). Uneven distribution triggers work stealing.`,
    `已添加 ${count} 个任务到 ${w.name}（队列：${w.queue.length}）。不均匀分布会触发 work stealing。`,
  );
  history.commit(workers.value, `addTask ${w.name} +${count}`);
}

function startProcessing() {
  if (running.value) return;
  running.value = true;
  message.value = t(
    'Processing... watch idle workers steal from busy ones.',
    '处理中... 观察空闲线程从繁忙线程窃取任务。',
  );
  stealHighlight.value = '';

  safeInterval(() => {
    if (!running.value) return;
    let anyWork = false;

    for (const w of workers.value) {
      if (w.queue.length > 0) {
        anyWork = true;
        w.queue[0].progress += 25;
        if (w.queue[0].progress >= 100) {
          w.queue.shift();
        }
      } else {
        const busiest = workers.value
          .filter((other) => other.name !== w.name && other.queue.length > 1)
          .sort((a, b) => b.queue.length - a.queue.length)[0];

        if (busiest) {
          const stolen = busiest.queue.pop()!;
          stolen.progress = 0;
          w.queue.push(stolen);
          w.stolen++;
          stealHighlight.value = `${busiest.name}->${w.name}`;
          log(
            t(
              `${w.name} stole #${stolen.id} from ${busiest.name}`,
              `${w.name} 从 ${busiest.name} 窃取 #${stolen.id}`,
            ),
            'warning',
          );
          message.value = t(
            `${w.name} stole task #${stolen.id} from ${busiest.name}! Stealing from the TAIL of the deque minimizes contention — this is the key to Go's goroutine scheduler.`,
            `${w.name} 从 ${busiest.name} 窃取了任务 #${stolen.id}！从双端队列的尾部窃取最小化竞争 — 这是 Go goroutine 调度器的关键。`,
          );
          anyWork = true;
          history.commit(workers.value, `steal ${busiest.name}->${w.name}`);
          safeTimeout(() => {
            stealHighlight.value = '';
          }, 400);
        }
      }
    }

    if (!anyWork) {
      stopProcessing();
      const totalStolen = workers.value.reduce((sum, w) => sum + w.stolen, 0);
      message.value = t(
        `All tasks completed! ${totalStolen} steals occurred. Without stealing, W1 would finish first while others idle — wasting CPU.`,
        `所有任务已完成！发生了 ${totalStolen} 次窃取。没有窃取的话，W1 会先完成而其他线程空闲 — 浪费 CPU。`,
      );
      log(t(`done: ${totalStolen} steals`, `完成：${totalStolen} 次窃取`), 'success');
      log(
        t(
          'Steal from tail, process from head — deque minimizes contention',
          '从尾部窃取，从头部处理 — 双端队列最小化争用',
        ),
        'highlight',
      );
    } else {
      history.commit(workers.value, 'process step');
    }
  }, 300);
}

function stopProcessing() {
  clearAll();
  running.value = false;
}

function reset() {
  stopProcessing();
  nextTaskId = 1;
  presetRunning = false;
  workers.value = [
    { name: 'W1', color: 'var(--viz-primary)', queue: [], stolen: 0 },
    { name: 'W2', color: 'var(--viz-success)', queue: [], stolen: 0 },
    { name: 'W3', color: 'var(--viz-warning)', queue: [], stolen: 0 },
  ];
  stealHighlight.value = '';
  clearLog();
  history.reset();
  message.value = t('Reset — add tasks and start processing', '已重置 — 添加任务并开始处理');
}

function presetImbalanced() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  addTasks(0, 8);
  log(t('W1: +8 tasks (queue: 8) — heavily loaded', 'W1：+8 任务（队列：8）— 重负载'), 'info');
  addTasks(1, 2);
  log(t('W2: +2 tasks (queue: 2) — lightly loaded', 'W2：+2 任务（队列：2）— 轻负载'), 'info');
  message.value = t(
    'Imbalanced: W1 has 8 tasks, W2 has 2, W3 has 0. Click Start — watch W3 steal from W1 to balance the load.',
    '不平衡：W1 有 8 个任务，W2 有 2 个，W3 有 0 个。点击开始 — 观察 W3 从 W1 窃取以平衡负载。',
  );
  presetRunning = false;
}

function presetAllBusy() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  addTasks(0, 4);
  log(t('W1: +4 tasks (queue: 4)', 'W1：+4 任务（队列：4）'), 'info');
  addTasks(1, 4);
  log(t('W2: +4 tasks (queue: 4)', 'W2：+4 任务（队列：4）'), 'info');
  addTasks(2, 4);
  log(t('W3: +4 tasks (queue: 4)', 'W3：+4 任务（队列：4）'), 'info');
  message.value = t(
    'All workers equally loaded — no stealing needed. This is the ideal initial distribution. Work stealing is a fallback, not the primary strategy.',
    '所有工作线程负载均等 — 无需窃取。这是理想的初始分布。Work stealing 是后备策略，而非主要策略。',
  );
  presetRunning = false;
}

function presetOneWorker() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  addTasks(0, 12);
  log(
    t(
      'W1: +12 tasks (queue: 12) — all work on one thread',
      'W1：+12 任务（队列：12）— 所有工作集中在一个线程',
    ),
    'info',
  );
  message.value = t(
    'Worst case: all 12 tasks on W1. W2 and W3 will steal aggressively. This models recursive task spawning (e.g., fork-join) where one thread generates all work.',
    '最坏情况：所有 12 个任务在 W1 上。W2 和 W3 会积极窃取。这模拟了递归任务生成（如 fork-join），其中一个线程生成所有工作。',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Work Stealing', '交互式 Work Stealing') }}</div>

    <div class="ws-workers">
      <div
        v-for="(w, i) in workers"
        :key="w.name"
        class="ws-worker"
        :class="{ 'ws-worker-stealing': stealHighlight.endsWith('->' + w.name) }"
        :style="{ borderColor: w.color }"
      >
        <div class="ws-worker-header">
          <span class="ws-worker-name" :style="{ color: w.color }">{{ w.name }}</span>
          <span class="ws-worker-stats">
            {{ t('queue:', '队列：') }} {{ w.queue.length }} | {{ t('stolen:', '窃取：') }}
            {{ w.stolen }}
          </span>
        </div>

        <div class="ws-queue">
          <div v-for="task in w.queue" :key="task.id" class="ws-task">
            <div class="ws-task-label">#{{ task.id }}</div>
            <div class="ws-task-bar">
              <div
                class="ws-task-fill"
                :style="{ width: task.progress + '%', background: w.color }"
              ></div>
            </div>
          </div>
          <div v-if="w.queue.length === 0" class="ws-empty">{{ t('idle', '空闲') }}</div>
        </div>

        <button class="viz-btn ws-add-btn" @click="addTasks(i)" :disabled="running">
          {{ t('+ 4 Tasks', '+ 4 任务') }}
        </button>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="startProcessing" :disabled="running">
        {{ t('Start', '开始') }}
      </button>
      <button class="viz-btn" @click="stopProcessing" :disabled="!running">
        {{ t('Stop', '停止') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetImbalanced">{{ t('Imbalanced', '不平衡') }}</button>
      <button class="viz-btn" @click="presetAllBusy">{{ t('All Busy', '全忙') }}</button>
      <button class="viz-btn" @click="presetOneWorker">{{ t('One Worker', '单线程') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.ws-workers {
  display: flex;
  gap: 8px;
  padding: 1rem 0;
}

@media (width <= 640px) {
  .ws-workers {
    flex-direction: column;
  }
}

.ws-worker {
  flex: 1;
  border: 2px solid;
  border-radius: var(--viz-radius-sm);
  padding: 0.5rem;
  background: var(--vp-c-bg);
  transition: box-shadow 0.3s;
}

.ws-worker-stealing {
  box-shadow: 0 0 12px rgb(245 158 11 / 40%);
  animation: ws-steal-flash 0.4s ease;
}

.ws-worker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.ws-worker-name {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
}

.ws-worker-stats {
  font-size: 0.6rem;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
}

.ws-queue {
  min-height: 60px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ws-task {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ws-task-label {
  font-size: 0.65rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  min-width: 24px;
}

.ws-task-bar {
  flex: 1;
  height: 10px;
  background: var(--viz-cell-empty);
  border-radius: var(--viz-radius-sm);
  overflow: hidden;
}

.ws-task-fill {
  height: 100%;
  border-radius: var(--viz-radius-sm);
  transition: width 0.2s;
}

.ws-empty {
  font-size: 0.7rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
  padding: 1rem 0;
}

.ws-add-btn {
  width: 100%;
  margin-top: 6px;
  font-size: 0.65rem;
  padding: 0.25rem;
}

@keyframes ws-steal-flash {
  0% {
    background: var(--vp-c-bg);
  }

  50% {
    background: rgb(245 158 11 / 10%);
  }

  100% {
    background: var(--vp-c-bg);
  }
}
</style>
