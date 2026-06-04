<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { safeInterval, clearAll, speed } = useVizTimers();

const QUEUE_CAP = 12;
const queue = ref<number[]>([]);
const produced = ref(0);
const consumed = ref(0);
const dropped = ref(0);
const producerRate = ref(3);
const consumerRate = ref(1);
const message = ref(t(
  'Start producer & consumer to see backpressure — or pick a scenario below',
  '启动生产者和消费者观察 Backpressure — 或选择下方场景'
));
const producerActive = ref(false);
const consumerActive = ref(false);
let nextItem = 1;
let presetRunning = false;

function startProducer() {
  if (producerActive.value) return;
  producerActive.value = true;
  safeInterval(() => {
    if (!producerActive.value) return;
    if (queue.value.length >= QUEUE_CAP) {
      dropped.value++;
      message.value = t(
        `BACKPRESSURE! Item #${nextItem} DROPPED — queue full at ${QUEUE_CAP}. In TCP, this triggers window shrinking; in RxJS, this drops or buffers.`,
        `背压！项目 #${nextItem} 被丢弃 — 队列已满（${QUEUE_CAP}）。在 TCP 中，这会触发窗口收缩；在 RxJS 中，会丢弃或缓冲。`
      );
      nextItem++;
    } else {
      queue.value.push(nextItem);
      produced.value++;
      const fill = Math.round((queue.value.length / QUEUE_CAP) * 100);
      if (fill >= 80) {
        message.value = t(
          `Produced #${nextItem} — queue at ${fill}%! Approaching backpressure threshold.`,
          `已生产 #${nextItem} — 队列 ${fill}%！即将触发背压阈值。`
        );
      } else {
        message.value = t(`Produced #${nextItem} — queue at ${fill}%`, `已生产 #${nextItem} — 队列 ${fill}%`);
      }
      nextItem++;
    }
  }, 1000 / producerRate.value);
}

function startConsumer() {
  if (consumerActive.value) return;
  consumerActive.value = true;
  safeInterval(() => {
    if (!consumerActive.value) return;
    if (queue.value.length > 0) {
      const item = queue.value.shift()!;
      consumed.value++;
      message.value = t(`Consumed #${item}`, `已消费 #${item}`);
    }
  }, 1000 / consumerRate.value);
}

function stopAll() {
  clearAll();
  producerActive.value = false;
  consumerActive.value = false;
  presetRunning = false;
  message.value = t('Stopped — producer and consumer paused.', '已停止 — 生产者和消费者已暂停。');
}

function reset() {
  stopAll();
  queue.value = [];
  produced.value = 0;
  consumed.value = 0;
  dropped.value = 0;
  nextItem = 1;
  message.value = t('Reset! Configure rates and start.', '已重置！配置速率并开始。');
}

function presetOverload() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  producerRate.value = 5;
  consumerRate.value = 1;
  startProducer();
  startConsumer();
  message.value = t(
    'Overload: producer 5x faster than consumer. Watch the queue fill up and items get dropped — this is why Node.js streams have highWaterMark.',
    '过载：生产者比消费者快 5 倍。观察队列填满和项目被丢弃 — 这就是 Node.js streams 有 highWaterMark 的原因。'
  );
}

function presetBalanced() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  producerRate.value = 2;
  consumerRate.value = 2;
  startProducer();
  startConsumer();
  message.value = t(
    'Balanced: producer and consumer at same rate. Queue stays stable — this is the ideal steady state.',
    '平衡：生产者和消费者速率相同。队列保持稳定 — 这是理想的稳态。'
  );
}

function presetBurst() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  producerRate.value = 5;
  consumerRate.value = 3;
  startProducer();
  message.value = t(
    'Burst: producer running alone, filling the buffer. The queue absorbs the burst — start consumer before overflow!',
    '突发：生产者独自运行，填充缓冲区。队列吸收突发 — 在溢出前启动消费者！'
  );
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
    <div class="viz-title">{{ t('Interactive Backpressure', '交互式 Backpressure') }} · cap={{ QUEUE_CAP }}</div>

    <div class="bp-flow">
      <!-- Producer -->
      <div class="bp-actor bp-producer">
        <div class="bp-actor-label">{{ t('Producer', '生产者') }}</div>
        <div class="bp-actor-rate">{{ producerRate }}/s</div>
      </div>

      <div class="bp-arrow">→</div>

      <!-- Queue -->
      <div class="bp-queue-wrap">
        <div class="bp-queue-label">{{ t('Queue', '队列') }} ({{ queue.length }}/{{ QUEUE_CAP }})</div>
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
          <div class="bp-queue-fill" :style="{ width: fillPercent() + '%', background: fillColor() }"></div>
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
      <span class="bp-stat">{{ t('Produced:', '已生产:') }} <strong>{{ produced }}</strong></span>
      <span class="bp-stat">{{ t('Consumed:', '已消费:') }} <strong>{{ consumed }}</strong></span>
      <span class="bp-stat bp-stat-drop">{{ t('Dropped:', '已丢弃:') }} <strong>{{ dropped }}</strong></span>
    </div>

    <!-- Rate controls -->
    <div class="bp-rates">
      <label class="bp-rate-label">
        <span class="viz-label">{{ t('Producer rate:', '生产速率：') }}</span>
        <input type="range" min="1" max="5" step="1" v-model.number="producerRate" class="bp-rate-slider" />
        <span class="bp-rate-val">{{ producerRate }}/s</span>
      </label>
      <label class="bp-rate-label">
        <span class="viz-label">{{ t('Consumer rate:', '消费速率：') }}</span>
        <input type="range" min="1" max="5" step="1" v-model.number="consumerRate" class="bp-rate-slider" />
        <span class="bp-rate-val">{{ consumerRate }}/s</span>
      </label>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="startProducer" :disabled="producerActive">{{ t('Start Producer', '启动生产者') }}</button>
      <button class="viz-btn" @click="startConsumer" :disabled="consumerActive">{{ t('Start Consumer', '启动消费者') }}</button>
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

    <div class="viz-status">{{ message }}</div>
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

@media (max-width: 640px) {
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
  border-radius: 8px;
  border: 2px solid var(--viz-border);
  background: var(--vp-c-bg);
  min-width: 70px;
}

.bp-producer { border-color: var(--viz-primary); }
.bp-consumer { border-color: var(--viz-success); }

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
  border-radius: 3px;
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
  transition: width 0.2s, background 0.2s;
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
  from { transform: scaleY(0.5); }
  to { transform: scaleY(1); }
}
</style>
