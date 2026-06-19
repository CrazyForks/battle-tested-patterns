<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeInterval, safeTimeout, clearAll, speed } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const QUEUE_CAP = 12;
const queue = ref<number[]>([]);
const produced = ref(0);
const consumed = ref(0);
const dropped = ref(0);
const blocked = ref(0);
// Strategy mirrors the pattern's strategy table: Block (default, lossless —
// producer waits for space) vs Drop (lossy — discard when full).
const strategy = ref<'block' | 'drop'>('block');
const producerWaiting = ref(false);
const producerRate = ref(3);
const consumerRate = ref(1);
const message = ref(
  t(
    'Start producer & consumer to see backpressure — or pick a scenario below',
    '启动生产者和消费者观察 Backpressure — 或选择下方场景',
  ),
);
const producerActive = ref(false);
const consumerActive = ref(false);
let nextItem = 1;
let presetRunning = false;
let producerTimerId: ReturnType<typeof setInterval> | null = null;
let consumerTimerId: ReturnType<typeof setInterval> | null = null;

interface BackpressureSnapshot {
  queue: number[];
  produced: number;
  consumed: number;
  dropped: number;
  blocked: number;
  producerWaiting: boolean;
}

const history = useVizHistory<BackpressureSnapshot>(
  { queue: [], produced: 0, consumed: 0, dropped: 0, blocked: 0, producerWaiting: false },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      clearAll();
      queue.value = snap.queue;
      produced.value = snap.produced;
      consumed.value = snap.consumed;
      dropped.value = snap.dropped;
      blocked.value = snap.blocked;
      producerWaiting.value = snap.producerWaiting;
      producerActive.value = false;
      consumerActive.value = false;
      if (msg !== undefined) message.value = msg;
    },
  },
);

function snapshot(): BackpressureSnapshot {
  return {
    queue: [...queue.value],
    produced: produced.value,
    consumed: consumed.value,
    dropped: dropped.value,
    blocked: blocked.value,
    producerWaiting: producerWaiting.value,
  };
}

function producerTick() {
  if (!producerActive.value) return;
  if (queue.value.length >= QUEUE_CAP) {
    if (strategy.value === 'block') {
      // Block strategy (default, lossless): the producer does NOT discard —
      // it waits for the consumer to free a slot. No item is produced this
      // tick; nothing is lost. This is what Go channels and Node.js streams
      // (write() returning false → wait for 'drain') actually do.
      blocked.value++;
      producerWaiting.value = true;
      message.value = t(
        `BACKPRESSURE! Producer BLOCKED — queue full at ${QUEUE_CAP}. The producer waits for a free slot instead of dropping. (Go channels & Node.js streams' 'drain' work this way.)`,
        `背压！生产者被阻塞 —— 队列已满（${QUEUE_CAP}）。生产者等待空位而非丢弃数据。（Go channel 与 Node.js streams 的 'drain' 即如此。）`,
      );
      log(message.value, 'warning');
      history.commit(snapshot(), `block (waiting)`);
      return;
    }
    // Drop strategy (lossy, opt-in): discard the newest item when full.
    dropped.value++;
    message.value = t(
      `Item #${nextItem} DROPPED — queue full at ${QUEUE_CAP}. Drop is the lossy strategy (metrics/telemetry); the buffer is bounded but data is lost.`,
      `项目 #${nextItem} 被丢弃 —— 队列已满（${QUEUE_CAP}）。丢弃是有损策略（用于指标/遥测）；缓冲区有界但数据会丢失。`,
    );
    log(message.value, 'error');
    history.commit(snapshot(), `drop #${nextItem}`);
    nextItem++;
  } else {
    producerWaiting.value = false;
    queue.value.push(nextItem);
    produced.value++;
    const fill = Math.round((queue.value.length / QUEUE_CAP) * 100);
    if (fill >= 80) {
      message.value = t(
        `Produced #${nextItem} — queue at ${fill}%! Approaching backpressure threshold.`,
        `已生产 #${nextItem} — 队列 ${fill}%！即将触发背压阈值。`,
      );
      log(message.value, 'warning');
    } else {
      message.value = t(
        `Produced #${nextItem} — queue at ${fill}%`,
        `已生产 #${nextItem} — 队列 ${fill}%`,
      );
      log(message.value, 'info');
    }
    history.commit(snapshot(), `produce #${nextItem}`);
    nextItem++;
  }
}

function consumerTick() {
  if (!consumerActive.value) return;
  if (queue.value.length > 0) {
    const item = queue.value.shift()!;
    consumed.value++;
    // Draining a slot releases a blocked producer (Block strategy).
    if (producerWaiting.value) producerWaiting.value = false;
    message.value = t(`Consumed #${item}`, `已消费 #${item}`);
    log(message.value, 'success');
    history.commit(snapshot(), `consume #${item}`);
  }
}

function startProducer() {
  if (producerActive.value) return;
  producerActive.value = true;
  producerTimerId = safeInterval(producerTick, 1000 / producerRate.value);
}

function startConsumer() {
  if (consumerActive.value) return;
  consumerActive.value = true;
  consumerTimerId = safeInterval(consumerTick, 1000 / consumerRate.value);
}

watch(producerRate, () => {
  if (producerActive.value) {
    if (producerTimerId !== null) clearInterval(producerTimerId);
    producerTimerId = safeInterval(producerTick, 1000 / producerRate.value);
  }
});

watch(consumerRate, () => {
  if (consumerActive.value) {
    if (consumerTimerId !== null) clearInterval(consumerTimerId);
    consumerTimerId = safeInterval(consumerTick, 1000 / consumerRate.value);
  }
});

function stopAll() {
  clearAll();
  producerActive.value = false;
  consumerActive.value = false;
  producerTimerId = null;
  consumerTimerId = null;
  presetRunning = false;
  message.value = t('Stopped — producer and consumer paused.', '已停止 — 生产者和消费者已暂停。');
}

function reset() {
  stopAll();
  queue.value = [];
  produced.value = 0;
  consumed.value = 0;
  dropped.value = 0;
  blocked.value = 0;
  producerWaiting.value = false;
  nextItem = 1;
  message.value = t('Reset! Configure rates and start.', '已重置！配置速率并开始。');
  clearLog();
  history.reset();
}

function presetOverload() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  strategy.value = 'block';
  producerRate.value = 5;
  consumerRate.value = 1;
  startProducer();
  startConsumer();
  message.value = t(
    'Overload (Block strategy): producer 5x faster than consumer. The queue fills, then the producer BLOCKS and waits for space — no data lost. This is why Node.js streams have highWaterMark + drain.',
    '过载（阻塞策略）：生产者比消费者快 5 倍。队列填满后生产者阻塞、等待空位 —— 不丢数据。这就是 Node.js streams 有 highWaterMark + drain 的原因。',
  );
  log(message.value, 'highlight');
}

function presetBalanced() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  strategy.value = 'block';
  producerRate.value = 2;
  consumerRate.value = 2;
  startProducer();
  startConsumer();
  message.value = t(
    'Balanced: producer and consumer at same rate. Queue stays stable — this is the ideal steady state.',
    '平衡：生产者和消费者速率相同。队列保持稳定 — 这是理想的稳态。',
  );
  log(message.value, 'highlight');
}

function presetBurst() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  strategy.value = 'block';
  producerRate.value = 5;
  consumerRate.value = 3;
  startProducer();
  message.value = t(
    'Burst: producer fills the buffer alone first. Consumer starts after 2s to drain. The queue absorbs the burst — this is why Kafka partitions act as shock absorbers.',
    '突发：生产者先独自填充缓冲区。2 秒后消费者启动排空。队列吸收突发 — 这就是 Kafka 分区充当减震器的原因。',
  );
  safeTimeout(() => {
    if (!presetRunning) return;
    startConsumer();
    message.value = t(
      "Consumer started! Watch the queue drain. With rate 3/s vs 5/s producer, the consumer can't keep up — the producer blocks until space frees up.",
      '消费者已启动！观察队列排空。消费速率 3/s vs 生产 5/s，消费者跟不上 — 生产者将阻塞，直到有空位。',
    );
    log(
      t(
        'The queue absorbs burst traffic as a shock absorber — but a sustained rate mismatch eventually blocks the producer (lossless), not drops.',
        '队列作为减震器吸收突发流量 — 但持续的速率不匹配最终会阻塞生产者（无损），而非丢弃。',
      ),
      'highlight',
    );
  }, 2000);
}

function fillPercent() {
  return (queue.value.length / QUEUE_CAP) * 100;
}

function fillColor() {
  const pct = fillPercent();
  if (pct >= 80) return 'var(--viz-danger)';
  if (pct >= 50) return 'var(--viz-warning)';
  return 'var(--viz-primary)';
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">
      {{ t('Interactive Backpressure', '交互式 Backpressure') }} · cap={{ QUEUE_CAP }}
    </div>

    <div class="bp-flow">
      <!-- Producer -->
      <div class="bp-actor bp-producer" :class="{ 'bp-actor-waiting': producerWaiting }">
        <div class="bp-actor-label">{{ t('Producer', '生产者') }}</div>
        <div class="bp-actor-rate">{{ producerRate }}/s</div>
        <div v-if="producerWaiting" class="bp-actor-state">{{ t('WAITING', '等待中') }}</div>
      </div>

      <div class="bp-arrow">→</div>

      <!-- Queue -->
      <div class="bp-queue-wrap">
        <div class="bp-queue-label">
          {{ t('Queue', '队列') }} ({{ queue.length }}/{{ QUEUE_CAP }})
        </div>
        <div class="bp-queue">
          <div
            v-for="i in QUEUE_CAP"
            :key="i"
            class="bp-slot"
            :class="{ 'bp-slot-filled': i <= queue.length }"
            :style="{ background: i <= queue.length ? fillColor() : undefined }"
          ></div>
        </div>
        <div class="bp-queue-bar">
          <div
            class="bp-queue-fill"
            :style="{ width: fillPercent() + '%', background: fillColor() }"
          ></div>
        </div>
      </div>

      <div class="bp-arrow">→</div>

      <!-- Consumer -->
      <div class="bp-actor bp-consumer">
        <div class="bp-actor-label">{{ t('Consumer', '消费者') }}</div>
        <div class="bp-actor-rate">{{ consumerRate }}/s</div>
      </div>
    </div>

    <!-- Stats -->
    <div class="bp-stats">
      <span class="bp-stat"
        >{{ t('Produced:', '已生产:') }} <strong>{{ produced }}</strong></span
      >
      <span class="bp-stat"
        >{{ t('Consumed:', '已消费:') }} <strong>{{ consumed }}</strong></span
      >
      <span v-if="strategy === 'block'" class="bp-stat bp-stat-block"
        >{{ t('Blocked:', '已阻塞:') }} <strong>{{ blocked }}</strong></span
      >
      <span v-else class="bp-stat bp-stat-drop"
        >{{ t('Dropped:', '已丢弃:') }} <strong>{{ dropped }}</strong></span
      >
    </div>

    <!-- Strategy toggle -->
    <div class="bp-strategy">
      <span class="viz-label">{{ t('When full:', '满时策略：') }}</span>
      <button
        class="viz-btn"
        :class="{ 'viz-btn--primary': strategy === 'block' }"
        @click="strategy = 'block'"
      >
        {{ t('Block (lossless)', '阻塞（无损）') }}
      </button>
      <button
        class="viz-btn"
        :class="{ 'viz-btn--primary': strategy === 'drop' }"
        @click="strategy = 'drop'"
      >
        {{ t('Drop (lossy)', '丢弃（有损）') }}
      </button>
    </div>

    <!-- Rate controls -->
    <div class="bp-rates">
      <label class="bp-rate-label">
        <span class="viz-label">{{ t('Producer rate:', '生产速率：') }}</span>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          v-model.number="producerRate"
          class="bp-rate-slider"
        />
        <span class="bp-rate-val">{{ producerRate }}/s</span>
      </label>
      <label class="bp-rate-label">
        <span class="viz-label">{{ t('Consumer rate:', '消费速率：') }}</span>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          v-model.number="consumerRate"
          class="bp-rate-slider"
        />
        <span class="bp-rate-val">{{ consumerRate }}/s</span>
      </label>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="startProducer" :disabled="producerActive">
        {{ t('Start Producer', '启动生产者') }}
      </button>
      <button class="viz-btn" @click="startConsumer" :disabled="consumerActive">
        {{ t('Start Consumer', '启动消费者') }}
      </button>
      <button class="viz-btn" @click="stopAll">{{ t('Stop All', '全部停止') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetOverload">{{ t('Overload', '过载') }}</button>
      <button class="viz-btn" @click="presetBalanced">{{ t('Balanced', '平衡') }}</button>
      <button class="viz-btn" @click="presetBurst">{{ t('Burst', '突发') }}</button>
    </div>

    <div class="viz-speed">
      <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
      <span class="viz-speed-val">{{ speed }}x</span>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.bp-flow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0;
  justify-content: center;
}

@media (width <= 640px) {
  .bp-flow {
    flex-direction: column;
  }
}

.bp-actor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.6rem 1rem;
  border-radius: var(--viz-radius-sm);
  border: 2px solid var(--viz-border);
  background: var(--vp-c-bg);
  min-width: 70px;
}

.bp-producer {
  border-color: var(--viz-primary);
}

.bp-actor-waiting {
  border-color: var(--viz-warning);
  animation: bp-wait-pulse 0.8s ease-in-out infinite;
}

.bp-actor-state {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-warning);
  letter-spacing: 0.05em;
}

@keyframes bp-wait-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

.bp-consumer {
  border-color: var(--viz-success);
}

.bp-actor-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-text);
}

.bp-actor-rate {
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.bp-arrow {
  font-size: 1.2rem;
  color: var(--viz-muted);
}

.bp-queue-wrap {
  text-align: center;
}

.bp-queue-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--viz-muted);
  margin-bottom: 4px;
}

.bp-queue {
  display: flex;
  gap: 2px;
}

.bp-slot {
  width: 16px;
  height: 24px;
  border-radius: var(--viz-radius-sm);
  background: var(--viz-cell-empty);
  transition: background 0.15s;
}

.bp-slot-filled {
  animation: bp-pop 0.15s ease;
}

.bp-queue-bar {
  margin-top: 4px;
  height: 4px;
  border-radius: 2px;
  background: var(--viz-cell-empty);
  overflow: hidden;
}

.bp-queue-fill {
  height: 100%;
  border-radius: 2px;
  transition:
    width 0.2s,
    background 0.2s;
}

.bp-stats {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  flex-wrap: wrap;
}

.bp-stat {
  font-size: 0.75rem;
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.bp-stat-drop {
  color: var(--viz-danger);
}

.bp-stat-block {
  color: var(--viz-warning);
}

.bp-strategy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.bp-rates {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.bp-rate-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bp-rate-slider {
  width: 80px;
  accent-color: var(--viz-primary);
}

.bp-rate-val {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--viz-text);
  min-width: 2rem;
}

@keyframes bp-pop {
  from {
    transform: scaleY(0.5);
  }

  to {
    transform: scaleY(1);
  }
}
</style>
