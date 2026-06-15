<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface Iterator {
  label: string;
  items: number[];
  pos: number;
}

const output = ref<number[]>([]);
const message = ref(
  t(
    'Press "Next" to pick the minimum head and advance — this is the k-way merge used by LSM-tree compaction, external sort, and merge sort',
    '按"下一个"选择最小的头元素并推进 — 这是 LSM 树压缩、外部排序和归并排序使用的 k 路合并',
  ),
);
const highlightIdx = ref(-1);
const pickedValue = ref<number | null>(null);
const done = ref(false);
let presetRunning = false;

const initialData: number[][] = [
  [1, 4, 7, 10, 13],
  [2, 5, 8, 11, 14],
  [3, 6, 9, 12, 15],
];

const iterators = ref<Iterator[]>(
  initialData.map((items, i) => ({
    label: `Iter ${i + 1}`,
    items: [...items],
    pos: 0,
  })),
);

interface Snapshot {
  iterators: Iterator[];
  output: number[];
  done: boolean;
}

const vizHistory = useVizHistory<Snapshot>(
  {
    iterators: initialData.map((items, i) => ({
      label: `Iter ${i + 1}`,
      items: [...items],
      pos: 0,
    })),
    output: [],
    done: false,
  },
  {
    getMessage: () => message.value,
    onRestore(s, msg) {
      presetRunning = false;
      iterators.value = s.iterators;
      output.value = s.output;
      done.value = s.done;
      highlightIdx.value = -1;
      pickedValue.value = null;
      if (msg !== undefined) message.value = msg;
    },
  },
);

const heads = computed(() =>
  iterators.value.map((it) => (it.pos < it.items.length ? it.items[it.pos] : null)),
);

function next() {
  if (done.value) return;

  let minVal = Infinity;
  let minIdx = -1;
  heads.value.forEach((h, i) => {
    if (h !== null && h < minVal) {
      minVal = h;
      minIdx = i;
    }
  });

  if (minIdx === -1) {
    done.value = true;
    message.value = t(
      `Merge complete! All iterators exhausted. Output: [${output.value.join(', ')}]. Time: O(n log k) with a min-heap, where k = number of iterators.`,
      `合并完成！所有迭代器已耗尽。输出：[${output.value.join(', ')}]。时间：O(n log k)，使用最小堆，k = 迭代器数量。`,
    );
    log(message.value, 'success');
    highlightIdx.value = -1;
    pickedValue.value = null;
    vizHistory.commit(
      { iterators: iterators.value, output: output.value, done: done.value },
      'Merge complete',
    );
    return;
  }

  highlightIdx.value = minIdx;
  pickedValue.value = minVal;
  const activeHeadCount = heads.value.filter((h) => h !== null).length;
  iterators.value[minIdx].pos++;
  output.value.push(minVal);

  const remaining = iterators.value.filter((it) => it.pos < it.items.length).length;
  message.value = t(
    `Picked ${minVal} from ${iterators.value[minIdx].label} (min of ${activeHeadCount} heads). ${remaining} iterator(s) still active.`,
    `从 ${iterators.value[minIdx].label} 选取 ${minVal}（${activeHeadCount} 个头元素的最小值）。${remaining} 个迭代器仍活跃。`,
  );

  if (remaining === 0) {
    done.value = true;
    message.value = t(
      `Picked ${minVal}. Merge complete! Output: [${output.value.join(', ')}]. This is how RocksDB compaction, SQL ORDER BY with multiple indexes, and hadoop MapReduce shuffle work.`,
      `选取 ${minVal}。合并完成！输出：[${output.value.join(', ')}]。RocksDB 压缩、SQL ORDER BY 多索引和 Hadoop MapReduce shuffle 就是这样工作的。`,
    );
    log(message.value, 'success');
  }
  vizHistory.commit(
    { iterators: iterators.value, output: output.value, done: done.value },
    `Pick ${minVal}`,
  );
}

function reset() {
  clearAll();
  iterators.value = initialData.map((items, i) => ({
    label: `Iter ${i + 1}`,
    items: [...items],
    pos: 0,
  }));
  output.value = [];
  highlightIdx.value = -1;
  pickedValue.value = null;
  done.value = false;
  presetRunning = false;
  message.value = t(
    'Press "Next" to pick the minimum head and advance',
    '按"下一个"选择最小的头元素并推进',
  );
  clearLog();
  vizHistory.reset();
}

async function presetAutoRun() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Auto-merging all 15 elements. Watch how the algorithm always picks the smallest head — a min-heap makes this O(log k) per pick instead of O(k).',
    '自动合并全部 15 个元素。观察算法如何总是选择最小的头元素 — 最小堆使每次选取从 O(k) 变为 O(log k)。',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  while (!done.value) {
    if (!presetRunning || isAborted()) return;
    next();
    if (!done.value && pickedValue.value !== null) {
      log(t(`pick ${pickedValue.value}`, `选取 ${pickedValue.value}`), 'info');
    }
    await delay(350);
  }
  log(
    t(
      'k-way merge: O(n log k) via min-heap — the core of LSM compaction',
      'k 路归并：通过最小堆实现 O(n log k) — LSM 压缩的核心',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetUnbalanced() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  iterators.value = [
    { label: 'Short', items: [1, 100], pos: 0 },
    { label: 'Medium', items: [2, 3, 4, 5], pos: 0 },
    { label: 'Long', items: [6, 7, 8, 9, 10, 11, 12], pos: 0 },
  ];
  output.value = [];
  done.value = false;
  message.value = t(
    'Unbalanced iterators: 2, 4, and 7 elements. The short iterator exhausts first. The algorithm handles this gracefully — exhausted iterators are simply skipped. LSM compaction often merges SSTables of very different sizes.',
    '不均衡迭代器：2、4 和 7 个元素。短迭代器先耗尽。算法优雅处理 — 耗尽的迭代器直接跳过。LSM 压缩经常合并大小差异很大的 SSTable。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  while (!done.value) {
    if (!presetRunning || isAborted()) return;
    next();
    if (!done.value && pickedValue.value !== null) {
      log(t(`pick ${pickedValue.value}`, `选取 ${pickedValue.value}`), 'info');
    }
    await delay(350);
  }
  log(
    t(
      'Graceful exhaustion: short iterators finish early, merge continues seamlessly',
      '优雅耗尽：短迭代器先结束，归并无缝继续',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetDuplicates() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  iterators.value = [
    { label: 'Iter 1', items: [1, 3, 5, 7], pos: 0 },
    { label: 'Iter 2', items: [1, 3, 5, 9], pos: 0 },
    { label: 'Iter 3', items: [2, 3, 6, 8], pos: 0 },
  ];
  output.value = [];
  done.value = false;
  message.value = t(
    'Duplicate keys: values 1, 3, 5 appear in multiple iterators. The merge produces duplicates — LSM compaction resolves this by keeping only the newest version. In SQL, UNION ALL preserves duplicates; UNION removes them.',
    '重复键：值 1、3、5 出现在多个迭代器中。合并产生重复 — LSM 压缩通过只保留最新版本来解决。在 SQL 中，UNION ALL 保留重复；UNION 移除它们。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  while (!done.value) {
    if (!presetRunning || isAborted()) return;
    next();
    if (!done.value && pickedValue.value !== null) {
      log(t(`pick ${pickedValue.value}`, `选取 ${pickedValue.value}`), 'info');
    }
    await delay(350);
  }
  log(
    t(
      'Duplicates preserved in merge — LSM resolves by keeping newest version',
      '归并保留重复 — LSM 通过保留最新版本解决',
    ),
    'highlight',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Merge Iterator', '交互式 Merge Iterator') }}</div>

    <div class="mi-iterators">
      <div
        v-for="(it, idx) in iterators"
        :key="idx"
        class="mi-row"
        :class="{ 'mi-row--active': highlightIdx === idx }"
      >
        <div class="mi-label">{{ it.label }}</div>
        <div class="mi-cells">
          <div
            v-for="(val, j) in it.items"
            :key="j"
            class="mi-cell"
            :class="{
              'mi-cell--consumed': j < it.pos,
              'mi-cell--head': j === it.pos,
              'mi-cell--picked': j === it.pos - 1 && highlightIdx === idx && pickedValue === val,
              'mi-cell--min': j === it.pos && highlightIdx === idx,
            }"
          >
            {{ val }}
          </div>
        </div>
        <div class="mi-head-indicator">
          <template v-if="it.pos < it.items.length"> head={{ it.items[it.pos] }} </template>
          <template v-else>
            <span class="mi-exhausted">{{ t('done', '完成') }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="mi-merge-arrow">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 4 L12 18 M8 14 L12 18 L16 14"
          stroke="var(--viz-primary)"
          stroke-width="2"
          fill="none"
        />
      </svg>
      <span>{{ t('merge (pick min)', '合并（选最小值）') }}</span>
    </div>

    <div class="mi-output">
      <div class="mi-output-label">{{ t('Output', '输出') }}</div>
      <div class="mi-output-cells">
        <div
          v-for="(val, i) in output"
          :key="i"
          class="mi-cell mi-cell--output"
          :class="{ 'mi-cell--just-added': i === output.length - 1 }"
        >
          {{ val }}
        </div>
        <div v-if="output.length === 0" class="mi-cell mi-cell--empty">...</div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" :disabled="done" @click="next">
        {{ t('Next', '下一个') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetAutoRun">{{ t('Auto Merge', '自动合并') }}</button>
      <button class="viz-btn" @click="presetUnbalanced">{{ t('Unbalanced', '不均衡') }}</button>
      <button class="viz-btn" @click="presetDuplicates">{{ t('Duplicates', '重复键') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.mi-iterators {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0;
}

.mi-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: var(--viz-radius-sm);
  border: 2px solid transparent;
  transition: all var(--viz-transition);
}

.mi-row--active {
  border-color: var(--viz-primary);
  background: color-mix(in srgb, var(--viz-primary) 8%, transparent);
}

.mi-label {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  min-width: 3rem;
}

.mi-cells {
  display: flex;
  gap: 3px;
}

.mi-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 32px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  transition: all var(--viz-transition);
}

.mi-cell--consumed {
  background: var(--viz-cell-empty);
  color: var(--viz-muted);
  opacity: 0.35;
  border-color: transparent;
  text-decoration: line-through;
}

.mi-cell--head {
  border-color: var(--viz-warning);
  font-weight: 700;
}

.mi-cell--min {
  border-color: var(--viz-success);
  background: var(--viz-success);
  color: #fff;
  animation: viz-pulse 0.4s ease;
}

.mi-cell--output {
  border-color: var(--viz-primary);
  background: color-mix(in srgb, var(--viz-primary) 12%, var(--vp-c-bg));
}

.mi-cell--just-added {
  animation: viz-slide-in 0.35s ease;
}

.mi-cell--empty {
  border-style: dashed;
  color: var(--viz-muted);
}

.mi-head-indicator {
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  white-space: nowrap;
}

.mi-exhausted {
  color: var(--viz-danger);
  font-weight: 600;
}

.mi-merge-arrow {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0;
  font-size: 0.75rem;
  color: var(--viz-primary);
  font-weight: 600;
}

.mi-output {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.mi-output-label {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-success);
  min-width: 3rem;
}

.mi-output-cells {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .mi-cell {
    width: 30px;
    height: 28px;
    font-size: 0.75rem;
  }
  .mi-label,
  .mi-output-label {
    min-width: 2.5rem;
    font-size: 0.6875rem;
  }
}
</style>
