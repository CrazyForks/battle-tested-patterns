<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const heap = ref<number[]>([]);
const message = ref(t('Insert values to build a min-heap, then extract the minimum', '插入值来构建最小堆，然后提取最小值'));
const highlightIndices = ref<number[]>([]);
const animType = ref<'insert' | 'extract' | 'swap' | ''>('');

const SVG_W = 400, SVG_H = 200;

function nodePos(index: number) {
  const depth = Math.floor(Math.log2(index + 1));
  const maxDepth = heap.value.length > 0 ? Math.floor(Math.log2(heap.value.length)) : 0;
  const nodesAtDepth = 1 << depth;
  const posInLevel = index - (nodesAtDepth - 1);
  const spacing = SVG_W / (nodesAtDepth + 1);
  return {
    x: spacing * (posInLevel + 1),
    y: 30 + depth * 50,
  };
}

const treeNodes = computed(() =>
  heap.value.map((val, i) => ({
    val,
    index: i,
    pos: nodePos(i),
    parent: i > 0 ? Math.floor((i - 1) / 2) : -1,
    highlighted: highlightIndices.value.includes(i),
  }))
);

const edges = computed(() =>
  treeNodes.value
    .filter(n => n.parent >= 0)
    .map(n => ({
      from: nodePos(n.parent),
      to: n.pos,
      key: `${n.parent}-${n.index}`,
    }))
);

async function insert() {
  const val = Math.floor(Math.random() * 99) + 1;
  heap.value.push(val);
  let i = heap.value.length - 1;
  highlightIndices.value = [i];
  animType.value = 'insert';
  message.value = t(`Inserted ${val} at index ${i}`, `已插入 ${val}，索引 ${i}`);

  await delay(300);
  if (aborted) return;

  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (heap.value[i] < heap.value[parent]) {
      highlightIndices.value = [i, parent];
      message.value = t(`Bubble up: swap ${heap.value[i]} ↔ ${heap.value[parent]}`, `上浮：交换 ${heap.value[i]} ↔ ${heap.value[parent]}`);
      await delay(400);
      if (aborted) return;
      [heap.value[i], heap.value[parent]] = [heap.value[parent], heap.value[i]];
      i = parent;
    } else {
      break;
    }
  }

  highlightIndices.value = [i];
  message.value = t(`${val} settled at index ${i} — heap property restored`, `${val} 落在索引 ${i} — 堆性质已恢复`);
  await delay(300);
  if (aborted) return;
  highlightIndices.value = [];
  animType.value = '';
}

async function extractMin() {
  if (heap.value.length === 0) {
    message.value = t('Heap is empty!', '堆为空！');
    return;
  }

  const min = heap.value[0];
  animType.value = 'extract';
  highlightIndices.value = [0];
  message.value = t(`Extracting min = ${min}`, `正在提取最小值 = ${min}`);
  await delay(300);
  if (aborted) return;

  if (heap.value.length === 1) {
    heap.value.pop();
    highlightIndices.value = [];
    animType.value = '';
    message.value = t(`Extracted ${min} — heap is now empty`, `已提取 ${min} — 堆现在为空`);
    return;
  }

  heap.value[0] = heap.value.pop()!;
  let i = 0;

  while (true) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    let smallest = i;

    if (left < heap.value.length && heap.value[left] < heap.value[smallest]) smallest = left;
    if (right < heap.value.length && heap.value[right] < heap.value[smallest]) smallest = right;

    if (smallest !== i) {
      highlightIndices.value = [i, smallest];
      message.value = t(`Sift down: swap ${heap.value[i]} ↔ ${heap.value[smallest]}`, `下沉：交换 ${heap.value[i]} ↔ ${heap.value[smallest]}`);
      await delay(400);
      if (aborted) return;
      [heap.value[i], heap.value[smallest]] = [heap.value[smallest], heap.value[i]];
      i = smallest;
    } else {
      break;
    }
  }

  highlightIndices.value = [];
  animType.value = '';
  message.value = t(`Extracted min = ${min} — heap property restored`, `已提取最小值 = ${min} — 堆性质已恢复`);
}

function reset() {
  heap.value = [];
  highlightIndices.value = [];
  animType.value = '';
  message.value = t('Heap cleared!', '堆已清空！');
}

let aborted = false;
onUnmounted(() => { aborted = true; });

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Min Heap', '交互式 Min Heap') }}</div>

    <!-- Tree view -->
    <svg :viewBox="`0 0 ${SVG_W} ${Math.max(SVG_H, (Math.floor(Math.log2(Math.max(heap.length, 1))) + 1) * 50 + 40)}`" class="heap-svg">
      <!-- Edges -->
      <line
        v-for="e in edges"
        :key="e.key"
        :x1="e.from.x"
        :y1="e.from.y"
        :x2="e.to.x"
        :y2="e.to.y"
        stroke="var(--viz-border)"
        stroke-width="1.5"
      />

      <!-- Nodes -->
      <g v-for="node in treeNodes" :key="node.index" :transform="`translate(${node.pos.x}, ${node.pos.y})`">
        <circle
          r="18"
          :fill="node.highlighted ? 'var(--viz-warning)' : 'var(--viz-primary)'"
          stroke="#fff"
          stroke-width="1.5"
          :class="{ 'heap-node-pulse': node.highlighted }"
        />
        <text
          text-anchor="middle"
          dominant-baseline="central"
          fill="#fff"
          font-size="11"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >
          {{ node.val }}
        </text>
      </g>

      <!-- Empty state -->
      <text v-if="heap.length === 0" :x="SVG_W / 2" :y="SVG_H / 2" text-anchor="middle" fill="var(--viz-muted)" font-size="13">
        {{ t('Empty — click Insert to add values', '空 — 点击插入来添加值') }}
      </text>
    </svg>

    <!-- Array view -->
    <div v-if="heap.length > 0" class="heap-array">
      <span class="viz-label">{{ t('Array:', '数组：') }}&nbsp;</span>
      <span
        v-for="(val, i) in heap"
        :key="i"
        class="heap-array-cell"
        :class="{ 'heap-array-cell--hl': highlightIndices.includes(i) }"
      >{{ val }}</span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="insert">{{ t('Insert Random', '插入随机值') }}</button>
      <button class="viz-btn" @click="extractMin">{{ t('Extract Min', '提取最小值') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.heap-svg {
  width: 100%;
  max-width: 420px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 120px;
}

.heap-node-pulse {
  animation: node-pulse 0.4s ease;
}

.heap-array {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  padding: 0.5rem 0;
}

.heap-array-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border: 1px solid var(--viz-border);
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--viz-text);
  background: var(--vp-c-bg);
  transition: all 0.2s ease;
}

.heap-array-cell--hl {
  background: var(--viz-warning);
  color: #fff;
  border-color: var(--viz-warning);
}

@keyframes node-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
