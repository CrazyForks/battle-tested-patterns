<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import VizLog from './VizLog.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const heap = ref<number[]>([]);
const message = ref(t(
  'Insert values to build a min-heap — or pick a scenario below to watch the algorithm in action',
  '插入值来构建最小堆 — 或选择下方场景观看算法运行过程'
));
const highlightIndices = ref<number[]>([]);
const animType = ref<'insert' | 'extract' | 'swap' | ''>('');
let presetRunning = false;

const SVG_W = 400, SVG_H = 200;

function nodePos(index: number) {
  const depth = Math.floor(Math.log2(index + 1));
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

async function insert(val?: number) {
  const v = val ?? Math.floor(Math.random() * 99) + 1;
  heap.value.push(v);
  let i = heap.value.length - 1;
  highlightIndices.value = [i];
  animType.value = 'insert';
  message.value = t(
    `Inserted ${v} at bottom (index ${i}). Now bubble up: compare with parent to restore heap property.`,
    `在底部插入 ${v}（索引 ${i}）。现在上浮：与父节点比较以恢复堆性质。`
  );
  log(message.value, 'info');

  await delay(300);
  if (isAborted()) return;

  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (heap.value[i] < heap.value[parent]) {
      highlightIndices.value = [i, parent];
      message.value = t(
        `${heap.value[i]} < ${heap.value[parent]} → swap! Heap invariant: every parent ≤ its children.`,
        `${heap.value[i]} < ${heap.value[parent]} → 交换！堆不变量：每个父节点 ≤ 其子节点。`
      );
      log(message.value, 'warning');
      await delay(400);
      if (isAborted()) return;
      [heap.value[i], heap.value[parent]] = [heap.value[parent], heap.value[i]];
      i = parent;
    } else {
      message.value = t(
        `${heap.value[i]} ≥ ${heap.value[parent]} → stop. Heap property satisfied.`,
        `${heap.value[i]} ≥ ${heap.value[parent]} → 停止。堆性质已满足。`
      );
      break;
    }
  }

  highlightIndices.value = [i];
  if (i === 0) {
    message.value = t(
      `${v} is now the root (minimum). In React Scheduler, this would be the highest-priority task.`,
      `${v} 现在是根节点（最小值）。在 React Scheduler 中，这将是最高优先级任务。`
    );
    log(message.value, 'success');
  }
  await delay(300);
  if (isAborted()) return;
  highlightIndices.value = [];
  animType.value = '';
}

async function extractMin() {
  if (heap.value.length === 0) {
    message.value = t('Heap is empty — nothing to extract!', '堆为空 — 没有可提取的元素！');
    return;
  }

  const min = heap.value[0];
  animType.value = 'extract';
  highlightIndices.value = [0];
  message.value = t(
    `Extracting min = ${min}. O(1) to find it (always at root). Now must restore heap property.`,
    `提取最小值 = ${min}。O(1) 找到它（总在根节点）。现在需要恢复堆性质。`
  );
  log(message.value, 'highlight');
  await delay(300);
  if (isAborted()) return;

  if (heap.value.length === 1) {
    heap.value.pop();
    highlightIndices.value = [];
    animType.value = '';
    message.value = t(`Extracted ${min} — heap is now empty.`, `已提取 ${min} — 堆现在为空。`);
    return;
  }

  heap.value[0] = heap.value.pop()!;
  message.value = t(
    `Moved last element (${heap.value[0]}) to root. Now sift down to find its correct position.`,
    `将最后一个元素 (${heap.value[0]}) 移至根节点。现在下沉以找到正确位置。`
  );
  let i = 0;

  while (true) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    let smallest = i;

    if (left < heap.value.length && heap.value[left] < heap.value[smallest]) smallest = left;
    if (right < heap.value.length && heap.value[right] < heap.value[smallest]) smallest = right;

    if (smallest !== i) {
      highlightIndices.value = [i, smallest];
      message.value = t(
        `Sift down: ${heap.value[i]} > ${heap.value[smallest]} → swap. Total: O(log n) swaps.`,
        `下沉：${heap.value[i]} > ${heap.value[smallest]} → 交换。总计：O(log n) 次交换。`
      );
      await delay(400);
      if (isAborted()) return;
      [heap.value[i], heap.value[smallest]] = [heap.value[smallest], heap.value[i]];
      i = smallest;
    } else {
      break;
    }
  }

  highlightIndices.value = [];
  animType.value = '';
  message.value = t(
    `Extracted min = ${min}. Heap property restored in O(log n). This is why schedulers use heaps.`,
    `已提取最小值 = ${min}。O(log n) 恢复堆性质。这就是调度器使用堆的原因。`
  );
  log(message.value, 'success');
}

function reset() {
  clearAll();
  heap.value = [];
  highlightIndices.value = [];
  animType.value = '';
  presetRunning = false;
  message.value = t('Heap cleared!', '堆已清空！');
  clearLog();
}

async function presetScheduler() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const tasks = [
    { val: 5, label: 'NormalPriority' },
    { val: 2, label: 'UserBlocking' },
    { val: 8, label: 'IdlePriority' },
    { val: 1, label: 'Immediate' },
    { val: 3, label: 'UserBlocking' },
  ];
  for (const task of tasks) {
    if (!presetRunning || isAborted()) return;
    await insert(task.val);
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'React Scheduler: extract-min always picks the highest-priority (lowest number) task next.',
    'React Scheduler：extract-min 总是选择优先级最高（数字最小）的任务。'
  );
  log(t('Min-heap: O(1) find-min, O(log n) insert/extract — the scheduler sweet spot', '最小堆：O(1) 查找最小值，O(log n) 插入/提取 — 调度器的最佳选择'), 'highlight');
  presetRunning = false;
}

async function presetHeapSort() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const vals = [42, 15, 73, 8, 31, 56, 23, 67];
  for (const v of vals) {
    if (!presetRunning || isAborted()) return;
    await insert(v);
    await delay(200);
    if (!presetRunning || isAborted()) return;
  }
  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'All inserted. Now extracting in sorted order — this is heap sort! O(n log n) total.',
    '全部插入完毕。现在按顺序提取 — 这就是堆排序！总计 O(n log n)。'
  );
  await delay(800);
  const sorted: number[] = [];
  while (heap.value.length > 0) {
    if (!presetRunning || isAborted()) return;
    const min = heap.value[0];
    await extractMin();
    sorted.push(min);
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    `Heap sort complete: [${sorted.join(', ')}] — each extraction is O(log n).`,
    `堆排序完成：[${sorted.join(', ')}] — 每次提取 O(log n)。`
  );
  log(t('Heap sort: O(n log n) with O(1) extra space — no worst-case degradation unlike quicksort', '堆排序：O(n log n)，O(1) 额外空间 — 不像快排有最坏退化'), 'highlight');
  presetRunning = false;
}

async function presetMergeSorted() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Merging two sorted streams via min-heap. This is how k-way merge works in database compaction and external sort.',
    '通过最小堆合并两个有序流。这就是数据库压缩和外部排序中 k 路合并的工作方式。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  const streams = [[3, 7, 11, 15], [2, 5, 9, 13]];
  for (let i = 0; i < Math.max(streams[0].length, streams[1].length); i++) {
    for (const stream of streams) {
      if (i < stream.length) {
        if (!presetRunning || isAborted()) return;
        await insert(stream[i]);
        await delay(300);
        if (!presetRunning || isAborted()) return;
      }
    }
  }
  message.value = t(
    'All elements merged into heap. The root always holds the global minimum — extract to get sorted output across both streams.',
    '所有元素已合并入堆。堆顶始终是全局最小值 — 提取即可获得两个流的排序输出。'
  );
  log(t('Min-heap enables O(log k) merge of k sorted streams — core of LSM compaction and external sort', '最小堆实现 k 个有序流的 O(log k) 合并 — LSM 压缩和外部排序的核心'), 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Min Heap', '交互式 Min Heap') }}</div>

    <!-- Tree view -->
    <svg :viewBox="`0 0 ${SVG_W} ${Math.max(SVG_H, (Math.floor(Math.log2(Math.max(heap.length, 1))) + 1) * 50 + 40)}`" class="heap-svg">
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

      <text v-if="heap.length === 0" :x="SVG_W / 2" :y="SVG_H / 2" text-anchor="middle" fill="var(--viz-muted)" font-size="13">
        {{ t('Empty — click Insert or pick a scenario', '空 — 点击插入或选择一个场景') }}
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
      <button class="viz-btn viz-btn--primary" @click="insert()">{{ t('Insert Random', '插入随机值') }}</button>
      <button class="viz-btn" @click="extractMin">{{ t('Extract Min', '提取最小值') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetScheduler">{{ t('React Scheduler', 'React 调度器') }}</button>
      <button class="viz-btn" @click="presetHeapSort">{{ t('Heap Sort', '堆排序') }}</button>
      <button class="viz-btn" @click="presetMergeSorted">{{ t('Merge Streams', '合并流') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
    <VizLog :entries="logEntries" @clear="clearLog" />
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
  animation: viz-pulse 0.4s ease;
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
</style>
