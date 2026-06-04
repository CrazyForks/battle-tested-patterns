<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
onUnmounted(() => { for (const tid of pendingTimers) clearTimeout(tid); });

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
const message = ref(t(`Items collect in the buffer — auto-flush at ${BATCH_THRESHOLD} items`, `元素在缓冲区中收集 — 达到 ${BATCH_THRESHOLD} 个时自动刷新`));
const flushing = ref(false);

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
    `Added ${item.label} — buffer ${buffer.value.length}/${BATCH_THRESHOLD}`,
    `已添加 ${item.label} — 缓冲区 ${buffer.value.length}/${BATCH_THRESHOLD}`
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
  message.value = t(`Flushing batch of ${items.length} items...`, `正在刷新 ${items.length} 个元素的批次...`);

  const tid = setTimeout(() => {
    pendingTimers.delete(tid);
    const batch: BatchRecord = {
      id: nextBatchId++,
      size: items.length,
      items: items.map(i => i.label),
    };
    batches.value = [...batches.value, batch];
    buffer.value = [];
    flushing.value = false;
    message.value = t(
      `Batch #${batch.id} flushed (${batch.size} items) — buffer cleared`,
      `批次 #${batch.id} 已刷新（${batch.size} 个元素）— 缓冲区已清空`
    );
  }, 600);
  pendingTimers.add(tid);
}

function reset() {
  buffer.value = [];
  batches.value = [];
  totalItems.value = 0;
  nextItemId = 1;
  nextBatchId = 1;
  flushing.value = false;
  message.value = t(
    `Reset — add items to fill the buffer (threshold: ${BATCH_THRESHOLD})`,
    `已重置 — 添加元素填满缓冲区（阈值: ${BATCH_THRESHOLD}）`
  );
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
  animation: bp-arrive 0.3s ease;
}

.bp-slot--flushing {
  border-color: var(--viz-success);
  background: rgba(16, 185, 129, 0.15);
  animation: bp-flush 0.5s ease;
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
  animation: bp-arrive 0.3s ease;
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

@keyframes bp-arrive {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bp-flush {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

@media (max-width: 640px) {
  .bp-layout { flex-direction: column; align-items: stretch; }
  .bp-arrow { justify-content: center; padding-top: 0; }
}
</style>
