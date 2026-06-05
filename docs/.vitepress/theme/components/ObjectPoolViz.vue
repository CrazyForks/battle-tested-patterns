<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import VizLog from './VizLog.vue';

const { t } = useI18n();
const { safeInterval, safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface PoolObject {
  id: number;
  name: string;
  state: 'available' | 'in-use';
  purpose: string;
  remaining: number;
  timerId: ReturnType<typeof setInterval> | undefined;
}

const INITIAL_POOL_SIZE = 5;
const USE_DURATION = 4000;
const TICK = 100;
const GROW_AMOUNT = 2;

let nextId = 1;
let presetRunning = false;

function makeObject(): PoolObject {
  const id = nextId++;
  return {
    id,
    name: `Obj-${id}`,
    state: 'available',
    purpose: '',
    remaining: 0,
    timerId: undefined,
  };
}

function createPool(size: number): PoolObject[] {
  return Array.from({ length: size }, () => makeObject());
}

const pool = ref<PoolObject[]>(createPool(INITIAL_POOL_SIZE));
const purposeInput = ref('');
const message = ref(t(
  'Pool ready — click "Acquire" to check out an object. Used by database connection pools (HikariCP, pgBouncer), thread pools (Java ExecutorService), and HTTP client pools.',
  'Object Pool 就绪 — 点击"获取"来签出对象。数据库连接池 (HikariCP、pgBouncer)、线程池 (Java ExecutorService) 和 HTTP 客户端池都使用此模式。'
));

const totalAcquires = ref(0);
const totalReleases = ref(0);
const poolHits = ref(0);
const poolMisses = ref(0);

const inUseCount = computed(() =>
  pool.value.filter((o) => o.state === 'in-use').length,
);
const availableCount = computed(() =>
  pool.value.filter((o) => o.state === 'available').length,
);
const poolSize = computed(() => pool.value.length);
const isExhausted = computed(() => availableCount.value === 0);

const defaultPurposes = ['HTTP conn', 'DB conn', 'Worker thread', 'File handle', 'Socket', 'gRPC channel'];
let purposeIndex = 0;

function getNextPurpose(): string {
  if (purposeInput.value.trim()) return purposeInput.value.trim();
  const p = defaultPurposes[purposeIndex % defaultPurposes.length];
  purposeIndex++;
  return p;
}

function acquire() {
  const purpose = getNextPurpose();
  const obj = pool.value.find((o) => o.state === 'available');
  if (!obj) {
    poolMisses.value++;
    message.value = t(
      `Pool exhausted! All ${poolSize.value} objects in use. Grow the pool or wait for a release.`,
      `池已耗尽！全部 ${poolSize.value} 个对象使用中。请扩容或等待归还。`,
    );
    return;
  }
  poolHits.value++;
  checkOut(obj, purpose);
  log(message.value, 'info');
  purposeInput.value = '';
}

function checkOut(obj: PoolObject, purpose: string) {
  totalAcquires.value++;
  obj.state = 'in-use';
  obj.purpose = purpose;
  obj.remaining = USE_DURATION;
  message.value = t(
    `${obj.name} acquired for "${purpose}" (auto-returns in ${(USE_DURATION / 1000).toFixed(0)}s, or click to return)`,
    `${obj.name} 已获取，用途"${purpose}"（${(USE_DURATION / 1000).toFixed(0)}s 后自动归还，或点击归还）`,
  );

  obj.timerId = safeInterval(() => {
    obj.remaining -= TICK;
    if (obj.remaining <= 0) {
      obj.remaining = 0;
      returnObject(obj, true);
    }
  }, TICK);
}

function returnObject(obj: PoolObject, auto = false) {
  if (obj.state !== 'in-use') return;
  if (obj.timerId !== undefined) {
    clearInterval(obj.timerId);
    obj.timerId = undefined;
  }
  const oldPurpose = obj.purpose;
  obj.state = 'available';
  obj.purpose = '';
  obj.remaining = 0;
  totalReleases.value++;

  if (auto) {
    message.value = t(
      `${obj.name} auto-returned after finishing "${oldPurpose}"`,
      `${obj.name} 完成"${oldPurpose}"后自动归还`,
    );
  } else {
    message.value = t(
      `${obj.name} manually returned (was: "${oldPurpose}")`,
      `${obj.name} 手动归还（用途："${oldPurpose}"）`,
    );
  }
  log(message.value, 'success');
}

function growPool() {
  for (let i = 0; i < GROW_AMOUNT; i++) {
    pool.value.push(makeObject());
  }
  message.value = t(
    `Pool grown by ${GROW_AMOUNT} — now ${poolSize.value} total capacity`,
    `池扩容 ${GROW_AMOUNT} 个 — 当前总容量 ${poolSize.value}`,
  );
}

function reset() {
  clearAll();
  nextId = 1;
  purposeIndex = 0;
  presetRunning = false;
  pool.value = createPool(INITIAL_POOL_SIZE);
  purposeInput.value = '';
  totalAcquires.value = 0;
  totalReleases.value = 0;
  poolHits.value = 0;
  poolMisses.value = 0;
  message.value = t('Pool reset — all objects available', '池已重置 — 所有对象可用');
  clearLog();
}

function stateColor(s: PoolObject['state']): string {
  return s === 'available' ? 'var(--viz-success)' : 'var(--viz-primary)';
}

function progressPercent(obj: PoolObject): number {
  if (obj.state !== 'in-use') return 0;
  return Math.max(0, (obj.remaining / USE_DURATION) * 100);
}

async function presetHighLoad() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'High load: acquiring all 5 objects rapidly. Watch the pool exhaust — this is what happens when HikariCP\'s maximumPoolSize is too small for your traffic.',
    '高负载：快速获取全部 5 个对象。观察池耗尽 — 当 HikariCP 的 maximumPoolSize 对流量来说太小时就会发生这种情况。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 5; i++) {
    if (!presetRunning || isAborted()) return;
    acquire();
    await delay(300);
  }
  await delay(300);
  if (!presetRunning || isAborted()) return;
  acquire();
  message.value = t(
    'Pool exhausted! The 6th request failed. Options: grow the pool (dynamic sizing), queue the request (bounded waiting), or reject fast (fail-open). HikariCP uses connectionTimeout to decide when to give up.',
    '池耗尽！第 6 个请求失败。选项：扩容（动态调整）、排队请求（有界等待）或快速拒绝（快速失败）。HikariCP 使用 connectionTimeout 决定何时放弃。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetAcquireRelease() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Acquire-release cycle: acquire 3 objects, return 2, acquire 2 more. The returned objects are reused — no allocation cost. This is the core value proposition of object pooling.',
    '获取-归还循环：获取 3 个对象，归还 2 个，再获取 2 个。归还的对象被重用 — 无分配成本。这是对象池的核心价值主张。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 3; i++) {
    if (!presetRunning || isAborted()) return;
    acquire();
    await delay(400);
  }
  await delay(500);
  if (!presetRunning || isAborted()) return;
  const inUse = pool.value.filter(o => o.state === 'in-use');
  if (inUse.length >= 2) {
    returnObject(inUse[0]);
    await delay(300);
    if (!presetRunning || isAborted()) return;
    returnObject(inUse[1]);
    await delay(500);
    if (!presetRunning || isAborted()) return;
  }
  acquire();
  await delay(300);
  if (!presetRunning || isAborted()) return;
  acquire();
  await delay(300);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Objects were reused — no new allocation needed. In JDBC pools, creating a new connection takes 5-50ms (TCP + TLS + auth). Reuse takes <0.1ms. That is 50-500x faster.',
    '对象被重用 — 无需新分配。在 JDBC 池中，创建新连接需 5-50ms (TCP + TLS + auth)。重用只需 <0.1ms。快 50-500 倍。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetDynamicGrowth() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Dynamic growth: exhaust the pool, then grow it. This models HikariCP\'s minimumIdle vs maximumPoolSize — start small, grow on demand, shrink when idle.',
    '动态增长：耗尽池，然后扩容。这模拟了 HikariCP 的 minimumIdle 与 maximumPoolSize — 小规模开始，按需增长，空闲时收缩。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 5; i++) {
    if (!presetRunning || isAborted()) return;
    acquire();
    await delay(250);
  }
  await delay(400);
  if (!presetRunning || isAborted()) return;
  growPool();
  await delay(400);
  if (!presetRunning || isAborted()) return;
  acquire();
  await delay(300);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Pool grew from 5 to 7. The new object was acquired immediately. But beware: unbounded growth causes resource exhaustion. pgBouncer caps at max_client_conn; Go\'s database/sql has SetMaxOpenConns.',
    '池从 5 增长到 7。新对象立即被获取。但注意：无限增长会导致资源耗尽。pgBouncer 限制 max_client_conn；Go 的 database/sql 有 SetMaxOpenConns。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Object Pool', '交互式 Object Pool') }}</div>

    <!-- Capacity bar -->
    <div class="op-capacity">
      <div class="op-capacity-bar">
        <div
          class="op-capacity-fill"
          :style="{ width: poolSize > 0 ? `${(inUseCount / poolSize) * 100}%` : '0%' }"
          :class="{ 'op-capacity-fill--danger': isExhausted && poolSize > 0 }"
        ></div>
      </div>
      <div class="op-capacity-label">
        {{ inUseCount }}/{{ poolSize }} {{ t('in use', '使用中') }}
      </div>
    </div>

    <!-- Stats bar -->
    <div class="op-stats">
      <div class="op-stat">
        <span class="op-stat-value">{{ poolSize }}</span>
        <span class="viz-label">{{ t('Capacity', '容量') }}</span>
      </div>
      <div class="op-stat">
        <span class="op-stat-value op-stat--primary">{{ inUseCount }}</span>
        <span class="viz-label">{{ t('In Use', '使用中') }}</span>
      </div>
      <div class="op-stat">
        <span class="op-stat-value op-stat--success">{{ availableCount }}</span>
        <span class="viz-label">{{ t('Available', '可用') }}</span>
      </div>
      <div class="op-stat">
        <span class="op-stat-value op-stat--success">{{ poolHits }}</span>
        <span class="viz-label">{{ t('Hits', '命中') }}</span>
      </div>
      <div class="op-stat">
        <span class="op-stat-value op-stat--danger">{{ poolMisses }}</span>
        <span class="viz-label">{{ t('Misses', '未命中') }}</span>
      </div>
    </div>

    <!-- Pool visualization -->
    <div class="op-pool">
      <div
        v-for="obj in pool"
        :key="obj.id"
        class="op-card"
        :class="{
          'op-card--available': obj.state === 'available',
          'op-card--in-use': obj.state === 'in-use',
        }"
        @click="obj.state === 'in-use' ? returnObject(obj) : undefined"
        :role="obj.state === 'in-use' ? 'button' : undefined"
        :tabindex="obj.state === 'in-use' ? 0 : undefined"
      >
        <div
          v-if="obj.state === 'in-use'"
          class="op-card-progress"
          :style="{ width: `${progressPercent(obj)}%` }"
        ></div>

        <div class="op-card-content">
          <div class="op-card-header">
            <span class="op-card-name">{{ obj.name }}</span>
            <span
              class="op-card-badge"
              :style="{ background: stateColor(obj.state) }"
            >
              {{ obj.state === 'in-use' ? t('IN USE', '使用中') : t('IDLE', '空闲') }}
            </span>
          </div>

          <div v-if="obj.state === 'in-use'" class="op-card-detail">
            <div class="op-card-purpose">"{{ obj.purpose }}"</div>
            <div class="op-card-timer">{{ (obj.remaining / 1000).toFixed(1) }}s</div>
            <div class="op-card-hint">{{ t('click to return', '点击归还') }}</div>
          </div>
          <div v-else class="op-card-detail">
            <div class="op-card-idle">{{ t('Ready', '就绪') }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pool exhaustion warning -->
    <div v-if="isExhausted && poolSize > 0" class="op-exhausted">
      <span class="op-exhausted-icon">&#9888;</span>
      <span>{{ t('Pool exhausted! All objects are in use.', '池已耗尽！所有对象使用中。') }}</span>
      <button class="viz-btn op-grow-btn" @click="growPool">
        {{ t(`Grow +${GROW_AMOUNT}`, `扩容 +${GROW_AMOUNT}`) }}
      </button>
    </div>

    <!-- Controls -->
    <div class="op-acquire-row">
      <input
        v-model="purposeInput"
        type="text"
        class="op-input"
        :placeholder="t('Purpose (e.g. HTTP conn, DB query)', '用途（如 HTTP 连接、DB 查询）')"
        @keyup.enter="acquire"
      />
      <button class="viz-btn viz-btn--primary" @click="acquire">{{ t('Acquire', '获取') }}</button>
    </div>
    <div class="viz-controls">
      <button class="viz-btn" @click="growPool">{{ t(`Grow Pool +${GROW_AMOUNT}`, `扩容 +${GROW_AMOUNT}`) }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetHighLoad">{{ t('High Load', '高负载') }}</button>
      <button class="viz-btn" @click="presetAcquireRelease">{{ t('Acquire & Release', '获取归还') }}</button>
      <button class="viz-btn" @click="presetDynamicGrowth">{{ t('Dynamic Growth', '动态增长') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.op-capacity {
  margin-bottom: 0.75rem;
}

.op-capacity-bar {
  height: 8px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--viz-border);
}

.op-capacity-fill {
  height: 100%;
  background: var(--viz-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.op-capacity-fill--danger {
  background: var(--viz-danger);
}

.op-capacity-label {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  margin-top: 0.25rem;
}

.op-stats {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.op-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 48px;
}

.op-stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.op-stat--primary { color: var(--viz-primary); }
.op-stat--success { color: var(--viz-success); }
.op-stat--danger { color: var(--viz-danger); }

.op-pool {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
  margin: 0.75rem 0;
}

.op-card {
  position: relative;
  border: 2px solid var(--viz-border);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
  background: var(--vp-c-bg);
}

.op-card--available {
  border-color: var(--viz-success);
  animation: viz-slide-in 0.4s ease;
}

.op-card--in-use {
  border-color: var(--viz-primary);
  cursor: pointer;
  animation: viz-pulse 0.3s ease;
}

.op-card--in-use:hover {
  border-color: var(--viz-warning);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--viz-warning) 25%, transparent);
}

.op-card--in-use:active {
  transform: scale(0.97);
}

.op-card-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: color-mix(in srgb, var(--viz-primary) 10%, transparent);
  transition: width 0.1s linear;
  pointer-events: none;
}

.op-card-content {
  position: relative;
  padding: 0.5rem;
  z-index: 1;
}

.op-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
}

.op-card-name {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.op-card-badge {
  font-size: 0.5625rem;
  font-weight: 700;
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.op-card-detail {
  min-height: 2rem;
}

.op-card-purpose {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--viz-primary);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-card-timer {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  margin-top: 0.125rem;
}

.op-card-hint {
  font-size: 0.625rem;
  color: var(--viz-muted);
  margin-top: 0.125rem;
}

.op-card-idle {
  font-size: 0.75rem;
  color: var(--viz-success);
  font-weight: 600;
}

.op-exhausted {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  margin: 0.5rem 0;
  border-radius: 6px;
  background: var(--viz-danger);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  flex-wrap: wrap;
}

.op-exhausted-icon {
  font-size: 1.125rem;
}

.op-grow-btn {
  background: rgba(255, 255, 255, 0.2) !important;
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  font-size: 0.75rem !important;
  padding: 0.2rem 0.6rem !important;
}

.op-grow-btn:hover {
  background: rgba(255, 255, 255, 0.35) !important;
}

.op-acquire-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.op-input {
  flex: 1;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--viz-text);
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-base);
  outline: none;
  transition: border-color 0.2s ease;
}

.op-input:focus {
  border-color: var(--viz-primary);
}

.op-input::placeholder {
  color: var(--viz-muted);
}

@media (max-width: 640px) {
  .op-stats {
    gap: 0.375rem;
  }
  .op-stat {
    min-width: 40px;
  }
  .op-stat-value {
    font-size: 1rem;
  }
  .op-pool {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.375rem;
  }
  .op-card-content {
    padding: 0.375rem;
  }
  .op-card-name {
    font-size: 0.75rem;
  }
  .op-acquire-row {
    flex-direction: column;
  }
  .op-exhausted {
    font-size: 0.75rem;
    gap: 0.375rem;
  }
}
</style>
