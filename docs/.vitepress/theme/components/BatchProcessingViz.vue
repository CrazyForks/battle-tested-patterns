<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { safeTimeout, clearAll, delay, speed, isAborted } = useVizTimers();

interface Item {
  id: number;
  label: string;
  state: 'buffered' | 'flushing';
}

interface BatchRecord {
  id: number;
  size: number;
  items: string[];
}

const BATCH_THRESHOLD = 5;

let nextItemId = 1;
let nextBatchId = 1;

const buffer = ref<Item[]>([]);
const batches = ref<BatchRecord[]>([]);
const totalItems = ref(0);
const message = ref(t(
  'Items collect in the buffer — auto-flush at 5 items. This amortizes per-item overhead, the same principle behind TCP Nagle\'s algorithm and database bulk inserts.',
  '元素在缓冲区中收集 — 达到 5 个时自动刷新。这分摊了每项开销，与 TCP Nagle 算法和数据库批量插入的原理相同。'
));
const flushing = ref(false);
let presetRunning = false;

const batchCount = computed(() => batches.value.length);
const avgPerBatch = computed(() => {
  if (batches.value.length === 0) return 0;
  const total = batches.value.reduce((sum, b) => sum + b.size, 0);
  return (total / batches.value.length).toFixed(1);
});

function addItem() {
  if (flushing.value) return;

  const item: Item = {
    id: nextItemId++,
    label: `item-${nextItemId - 1}`,
    state: 'buffered',
  };
  buffer.value = [...buffer.value, item];
  totalItems.value++;
  message.value = t(
    `Added ${item.label} — buffer ${buffer.value.length}/${BATCH_THRESHOLD}. Each item alone would need a full round-trip; batching reduces N calls to 1.`,
    `已添加 ${item.label} — 缓冲区 ${buffer.value.length}/${BATCH_THRESHOLD}。每个元素单独需要完整的往返；批处理将 N 次调用减少为 1 次。`
  );

  if (buffer.value.length >= BATCH_THRESHOLD) {
    flushBatch();
  }
}

function flushBatch() {
  if (buffer.value.length === 0) {
    message.value = t('Buffer empty — nothing to flush', '缓冲区为空 — 无需刷新');
    return;
  }
  if (flushing.value) return;

  flushing.value = true;
  const items = buffer.value;
  for (const item of items) {
    item.state = 'flushing';
  }
  message.value = t(
    `Flushing batch of ${items.length} items... In databases, this is the difference between INSERT per row vs. INSERT ... VALUES (bulk). 10-100x throughput gain.`,
    `正在刷新 ${items.length} 个元素的批次... 在数据库中，这就是单行 INSERT 与 INSERT ... VALUES（批量）的区别。吞吐量提升 10-100 倍。`
  );

  safeTimeout(() => {
    const batch: BatchRecord = {
      id: nextBatchId++,
      size: items.length,
      items: items.map(i => i.label),
    };
    batches.value = [...batches.value, batch];
    buffer.value = [];
    flushing.value = false;
    message.value = t(
      `Batch #${batch.id} flushed (${batch.size} items) — buffer cleared. React batches setState calls the same way: multiple updates, one re-render.`,
      `批次 #${batch.id} 已刷新（${batch.size} 个元素）— 缓冲区已清空。React 以相同方式批量处理 setState 调用：多次更新，一次重渲染。`
    );
  }, 600);
}

function reset() {
  clearAll();
  buffer.value = [];
  batches.value = [];
  totalItems.value = 0;
  nextItemId = 1;
  nextBatchId = 1;
  flushing.value = false;
  presetRunning = false;
  message.value = t(
    `Reset — add items to fill the buffer (threshold: ${BATCH_THRESHOLD})`,
    `已重置 — 添加元素填满缓冲区（阈值: ${BATCH_THRESHOLD}）`
  );
}

async function presetAutoFill() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Auto-filling buffer to threshold — watch it auto-flush. This is exactly how Kafka producers batch records: fill buffer, send when full or timeout.',
    '自动填充缓冲区至阈值 — 观察自动刷新。这正是 Kafka 生产者批量处理记录的方式：填充缓冲区，满时或超时发送。'
  );
  await delay(600);
  for (let i = 0; i < 5; i++) {
    if (!presetRunning || isAborted()) return;
    addItem();
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Buffer reached threshold and auto-flushed. In Kafka, linger.ms and batch.size control this tradeoff between latency and throughput.',
    '缓冲区达到阈值并自动刷新。在 Kafka 中，linger.ms 和 batch.size 控制延迟与吞吐量之间的权衡。'
  );
  presetRunning = false;
}

async function presetPartialFlush() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Adding 3 items then force-flushing before threshold. This is the "timeout flush" — don\'t wait forever for a full batch. HTTP/2 and gRPC use deadline-based flushing.',
    '添加 3 个元素然后在阈值前强制刷新。这是"超时刷新" — 不要永远等待满批。HTTP/2 和 gRPC 使用基于截止时间的刷新。'
  );
  await delay(600);
  for (let i = 0; i < 3; i++) {
    if (!presetRunning || isAborted()) return;
    addItem();
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Buffer has 3/5 items — force flushing a partial batch. Better to send 3 items now than wait indefinitely for 5.',
    '缓冲区有 3/5 个元素 — 强制刷新部分批次。现在发送 3 个比无限期等待 5 个要好。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  flushBatch();
  presetRunning = false;
}

async function presetMultiBatch() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Adding 12 items — will produce 2 full batches + 2 remaining. Watch the batch count grow. PostgreSQL COPY command uses unbounded batching for maximum throughput.',
    '添加 12 个元素 — 将产生 2 个完整批次 + 2 个剩余。观察批次数增长。PostgreSQL COPY 命令使用无界批处理以获得最大吞吐量。'
  );
  await delay(600);
  for (let i = 0; i < 12; i++) {
    if (!presetRunning || isAborted()) return;
    addItem();
    await delay(250);
    if (!presetRunning || isAborted()) return;
  }
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    `${batchCount.value} batches processed, ${buffer.value.length} items remaining in buffer. Total throughput: ${totalItems.value} items. Force flush to clear remaining.`,
    `${batchCount.value} 个批次已处理，缓冲区剩余 ${buffer.value.length} 个元素。总吞吐量：${totalItems.value} 个元素。强制刷新以清除剩余。`
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Batch Processing', '交互式批处理') }}</div>

    <!-- Stats -->
    <div class="bp-stats">
      <div class="bp-stat">
        <span class="bp-stat-value">{{ totalItems }}</span>
        <span class="viz-label">{{ t('Total Items', '总元素') }}</span>
      </div>
      <div class="bp-stat">
        <span class="bp-stat-value bp-stat--primary">{{ batchCount }}</span>
        <span class="viz-label">{{ t('Batches', '批次') }}</span>
      </div>
      <div class="bp-stat">
        <span class="bp-stat-value bp-stat--success">{{ avgPerBatch }}</span>
        <span class="viz-label">{{ t('Avg/Batch', '均值/批') }}</span>
      </div>
    </div>

    <div class="bp-layout">
      <!-- Buffer -->
      <div class="bp-section">
        <div class="bp-section-title">
          {{ t('Buffer', '缓冲区') }} ({{ buffer.length }}/{{ BATCH_THRESHOLD }})
        </div>
        <div class="bp-buffer">
          <div class="bp-slots">
            <div
              v-for="i in BATCH_THRESHOLD"
              :key="i"
              class="bp-slot"
              :class="{
                'bp-slot--filled': buffer[i - 1],
                'bp-slot--flushing': buffer[i - 1]?.state === 'flushing',
              }"
            >
              <span v-if="buffer[i - 1]" class="bp-slot-label">{{ buffer[i - 1].label }}</span>
              <span v-else class="bp-slot-empty">{{ i }}</span>
            </div>
          </div>
          <!-- Progress bar under buffer -->
          <div class="bp-progress">
            <div
              class="bp-progress-fill"
              :class="{ 'bp-progress--full': buffer.length >= BATCH_THRESHOLD }"
              :style="{ width: (buffer.length / BATCH_THRESHOLD) * 100 + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Arrow -->
      <div class="bp-arrow" :class="{ 'bp-arrow--active': flushing }">
        {{ flushing ? t('flushing...', '刷新中...') : t('flush', '刷新') }} &#8594;
      </div>

      <!-- Processed batches -->
      <div class="bp-section">
        <div class="bp-section-title">{{ t('Processed Batches', '已处理批次') }}</div>
        <div class="bp-batches">
          <div
            v-for="batch in batches"
            :key="batch.id"
            class="bp-batch"
          >
            <span class="bp-batch-id">Batch #{{ batch.id }}</span>
            <span class="bp-batch-size">{{ batch.size }} {{ t('items', '个元素') }}</span>
          </div>
          <div v-if="batches.length === 0" class="bp-empty">{{ t('no batches yet', '暂无批次') }}</div>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="addItem" :disabled="flushing">{{ t('Add Item', '添加元素') }}</button>
      <button class="viz-btn" @click="flushBatch" :disabled="flushing || buffer.length === 0">{{ t('Force Flush', '强制刷新') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetAutoFill">{{ t('Auto Fill', '自动填充') }}</button>
      <button class="viz-btn" @click="presetPartialFlush">{{ t('Partial Flush', '部分刷新') }}</button>
      <button class="viz-btn" @click="presetMultiBatch">{{ t('Multi-Batch', '多批次') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.bp-stats {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.bp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 56px;
}

.bp-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.bp-stat--primary { color: var(--viz-primary); }
.bp-stat--success { color: var(--viz-success); }

.bp-layout {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 1rem 0;
}

.bp-section {
  flex: 1;
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  padding: 0.5rem;
  background: var(--vp-c-bg);
}

.bp-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-bottom: 0.375rem;
}

.bp-slots {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.bp-slot {
  width: 52px;
  height: 36px;
  border: 1px dashed var(--viz-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  background: var(--viz-cell-empty);
}

.bp-slot--filled {
  border-style: solid;
  border-color: var(--viz-primary);
  background: rgba(59, 130, 246, 0.1);
  animation: viz-slide-in 0.3s ease;
}

.bp-slot--flushing {
  border-color: var(--viz-success);
  background: rgba(16, 185, 129, 0.15);
  animation: viz-pulse 0.5s ease;
}

.bp-slot-label {
  font-size: 0.5625rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.bp-slot-empty {
  font-size: 0.625rem;
  color: var(--viz-muted);
}

.bp-progress {
  height: 4px;
  border-radius: 2px;
  background: var(--viz-cell-empty);
  margin-top: 0.375rem;
  overflow: hidden;
}

.bp-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--viz-primary);
  transition: width 0.3s ease;
}

.bp-progress--full {
  background: var(--viz-success);
}

.bp-arrow {
  display: flex;
  align-items: center;
  font-size: 0.7rem;
  color: var(--viz-muted);
  padding-top: 1.5rem;
  white-space: nowrap;
  transition: color 0.3s ease;
}

.bp-arrow--active {
  color: var(--viz-success);
  font-weight: 700;
}

.bp-batches {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 60px;
}

.bp-batch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.08);
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  animation: viz-slide-in 0.3s ease;
}

.bp-batch-id {
  font-weight: 700;
  color: var(--viz-success);
}

.bp-batch-size {
  color: var(--viz-text);
}

.bp-empty {
  font-size: 0.7rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

@media (max-width: 640px) {
  .bp-layout { flex-direction: column; align-items: stretch; }
  .bp-arrow { justify-content: center; padding-top: 0; }
}
</style>
