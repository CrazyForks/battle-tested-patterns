<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const SOURCE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TAKE_COUNT = 3;

interface PipelineState {
  sourceIdx: number;
  filterPassed: number[];
  filterRejected: number[];
  mapResults: number[];
  taken: number[];
  collected: number[];
  elementsProcessed: number;
  done: boolean;
}

const state = reactive<PipelineState>({
  sourceIdx: -1,
  filterPassed: [],
  filterRejected: [],
  mapResults: [],
  taken: [],
  collected: [],
  elementsProcessed: 0,
  done: false,
});

const activeStage = ref<string | null>(null);
const activeValue = ref<number | null>(null);
const animating = ref(false);
const message = ref(
  t(
    'Click "Pull Next" to pull one element through the lazy pipeline — this is how Rust iterators, Java Streams, and Python generators work',
    '点击"拉取下一个"将一个元素拉过惰性管道 — Rust 迭代器、Java Streams 和 Python 生成器就是这样工作的',
  ),
);
let presetRunning = false;

/* ── Time-travel history ── */
type IteratorSnapshot = PipelineState;

const vizHistory = useVizHistory<IteratorSnapshot>(
  {
    sourceIdx: -1,
    filterPassed: [],
    filterRejected: [],
    mapResults: [],
    taken: [],
    collected: [],
    elementsProcessed: 0,
    done: false,
  },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      state.sourceIdx = snap.sourceIdx;
      state.filterPassed = snap.filterPassed;
      state.filterRejected = snap.filterRejected;
      state.mapResults = snap.mapResults;
      state.taken = snap.taken;
      state.collected = snap.collected;
      state.elementsProcessed = snap.elementsProcessed;
      state.done = snap.done;
      activeStage.value = null;
      activeValue.value = null;
      animating.value = false;
      if (msg !== undefined) message.value = msg;
    },
  },
);

async function pullNext() {
  if (state.done || animating.value) return;

  if (state.taken.length >= TAKE_COUNT) {
    state.done = true;
    message.value = t(
      `Take(${TAKE_COUNT}) satisfied! Pipeline complete. Only ${state.elementsProcessed} of ${SOURCE.length} source elements were touched — laziness saved ${SOURCE.length - state.elementsProcessed} evaluations.`,
      `Take(${TAKE_COUNT}) 已满足！管道完成。仅访问了 ${SOURCE.length} 个源元素中的 ${state.elementsProcessed} 个 — 惰性求值节省了 ${SOURCE.length - state.elementsProcessed} 次计算。`,
    );
    activeStage.value = null;
    activeValue.value = null;
    vizHistory.commit({ ...state }, `done (${state.taken.length}/${TAKE_COUNT})`);
    return;
  }

  animating.value = true;

  while (state.sourceIdx < SOURCE.length - 1 && state.taken.length < TAKE_COUNT) {
    state.sourceIdx++;
    state.elementsProcessed++;
    const val = SOURCE[state.sourceIdx];

    activeStage.value = 'source';
    activeValue.value = val;
    message.value = t(`Source: pulling element ${val}`, `Source：拉取元素 ${val}`);
    await delay(400);
    if (isAborted()) return;

    activeStage.value = 'filter';
    message.value = t(`Filter(isOdd): checking ${val}...`, `Filter(isOdd)：检查 ${val}...`);
    await delay(400);
    if (isAborted()) return;

    if (val % 2 === 0) {
      state.filterRejected = [...state.filterRejected, val];
      activeStage.value = 'filter-reject';
      message.value = t(
        `Filter: ${val} is even -> rejected. Pulling next from source. No downstream work wasted.`,
        `Filter：${val} 是偶数 -> 已过滤。从 Source 拉取下一个。不浪费下游工作。`,
      );
      await delay(300);
      if (isAborted()) return;
      continue;
    }

    state.filterPassed = [...state.filterPassed, val];
    message.value = t(`Filter: ${val} is odd -> passed!`, `Filter：${val} 是奇数 -> 通过！`);
    await delay(300);
    if (isAborted()) return;

    activeStage.value = 'map';
    const mapped = val * 10;
    message.value = t(`Map(*10): ${val} -> ${mapped}`, `Map(*10)：${val} -> ${mapped}`);
    activeValue.value = mapped;
    await delay(400);
    if (isAborted()) return;
    state.mapResults = [...state.mapResults, mapped];

    activeStage.value = 'take';
    message.value = t(
      `Take(${TAKE_COUNT}): collected ${state.taken.length + 1} of ${TAKE_COUNT}`,
      `Take(${TAKE_COUNT})：已收集 ${state.taken.length + 1}/${TAKE_COUNT}`,
    );
    await delay(300);
    if (isAborted()) return;
    state.taken = [...state.taken, mapped];

    activeStage.value = 'collect';
    state.collected = [...state.collected, mapped];
    message.value = t(
      `Collected: [${state.collected.join(', ')}]`,
      `已收集：[${state.collected.join(', ')}]`,
    );
    await delay(300);
    if (isAborted()) return;

    break;
  }

  if (state.taken.length >= TAKE_COUNT) {
    state.done = true;
    message.value = t(
      `Pipeline complete! Result: [${state.collected.join(', ')}]. Processed ${state.elementsProcessed} of ${SOURCE.length} elements. This is pull-based evaluation — Rust's .iter().filter().map().take().collect() chain.`,
      `管道完成！结果：[${state.collected.join(', ')}]。处理了 ${SOURCE.length} 个元素中的 ${state.elementsProcessed} 个。这是基于拉取的求值 — Rust 的 .iter().filter().map().take().collect() 链。`,
    );
    log(message.value, 'success');
  } else if (state.sourceIdx >= SOURCE.length - 1 && state.taken.length < TAKE_COUNT) {
    state.done = true;
    message.value = t(
      `Source exhausted. Got [${state.collected.join(', ')}] (${state.taken.length} of ${TAKE_COUNT} requested)`,
      `Source 已耗尽。获得 [${state.collected.join(', ')}]（请求 ${TAKE_COUNT} 个，实际 ${state.taken.length} 个）`,
    );
  }

  activeStage.value = null;
  activeValue.value = null;
  animating.value = false;
  vizHistory.commit({ ...state }, `step ${state.elementsProcessed}`);
}

function reset() {
  clearAll();
  state.sourceIdx = -1;
  state.filterPassed = [];
  state.filterRejected = [];
  state.mapResults = [];
  state.taken = [];
  state.collected = [];
  state.elementsProcessed = 0;
  state.done = false;
  activeStage.value = null;
  activeValue.value = null;
  animating.value = false;
  presetRunning = false;
  message.value = t(
    'Reset. Click "Pull Next" to start pulling elements lazily.',
    '已重置。点击"拉取下一个"开始惰性拉取元素。',
  );
  clearLog();
  vizHistory.reset();
}

function stageActive(name: string): boolean {
  return activeStage.value === name;
}

function sourceState(idx: number): string {
  if (idx === state.sourceIdx && activeStage.value === 'source') return 'active';
  if (idx <= state.sourceIdx) return 'consumed';
  return 'waiting';
}

async function presetFullRun() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Auto-run: pulling all 3 elements through the pipeline. Watch how even elements are rejected early — no map() call wasted on them.',
    '自动运行：拉取全部 3 个元素通过管道。观察偶数元素如何被提前过滤 — 不在它们上浪费 map() 调用。',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  while (!state.done) {
    if (!presetRunning || isAborted()) return;
    await pullNext();
    await delay(300);
  }
  log(
    t(
      'Lazy evaluation skips even-number map() calls entirely — work is only done for elements that pass the filter.',
      '惰性求值完全跳过偶数的 map() 调用 — 仅对通过过滤器的元素执行工作。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetShortCircuit() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Short-circuit demo: Take(3) stops the pipeline after 3 results. Elements 6-10 are never touched. This is why .find() on a lazy iterator is O(k), not O(n).',
    '短路演示：Take(3) 在 3 个结果后停止管道。元素 6-10 永远不会被访问。这就是惰性迭代器上的 .find() 是 O(k) 而非 O(n) 的原因。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  while (!state.done) {
    if (!presetRunning || isAborted()) return;
    await pullNext();
    await delay(200);
  }
  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    `Done! ${state.elementsProcessed} elements processed, ${SOURCE.length - state.elementsProcessed} never touched. An eager pipeline would process all ${SOURCE.length} first, then take 3 — wasting ${SOURCE.length - state.elementsProcessed} map() calls.`,
    `完成！${state.elementsProcessed} 个元素被处理，${SOURCE.length - state.elementsProcessed} 个未被访问。急切管道会先处理全部 ${SOURCE.length} 个，再取 3 个 — 浪费 ${SOURCE.length - state.elementsProcessed} 次 map() 调用。`,
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetStepByStep() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Step-by-step: pull just one element, pause to observe. Each pull triggers source -> filter -> map -> take -> collect for one item. This is the iterator protocol: next() returns one value at a time.',
    '逐步：只拉取一个元素，暂停观察。每次拉取触发一个元素的 source -> filter -> map -> take -> collect。这就是迭代器协议：next() 每次返回一个值。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  await pullNext();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    `First result collected. Notice: source processed ${state.elementsProcessed} element(s) to get 1 output (even numbers were filtered). Click "Pull Next" to continue manually.`,
    `第一个结果已收集。注意：源处理了 ${state.elementsProcessed} 个元素才得到 1 个输出（偶数被过滤了）。点击"拉取下一个"手动继续。`,
  );
  log(
    t(
      'Pull-based iteration processes one element at a time through the full pipeline before pulling the next.',
      '基于拉取的迭代每次将一个元素通过完整管道处理后再拉取下一个。',
    ),
    'highlight',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">
      {{ t('Interactive Lazy Iterator Pipeline', '交互式惰性 Iterator 管道') }}
    </div>

    <!-- Stats bar -->
    <div class="it-stats">
      <div class="it-stat">
        <span class="it-stat-value">{{ state.elementsProcessed }}</span>
        <span class="viz-label">{{ t('Processed', '已处理') }}</span>
      </div>
      <div class="it-stat">
        <span class="it-stat-value">{{ SOURCE.length }}</span>
        <span class="viz-label">{{ t('In Source', '源中总数') }}</span>
      </div>
      <div class="it-stat">
        <span class="it-stat-value it-stat-value--success">{{ state.collected.length }}</span>
        <span class="viz-label">{{ t('Collected', '已收集') }}</span>
      </div>
      <div class="it-stat">
        <span class="it-stat-value it-stat-value--saved">{{
          SOURCE.length - state.elementsProcessed
        }}</span>
        <span class="viz-label">{{ t('Never Touched', '未访问') }}</span>
      </div>
    </div>

    <!-- Pipeline stages -->
    <div class="it-pipeline">
      <div class="it-stage" :class="{ 'it-stage--active': stageActive('source') }">
        <div class="it-stage-header">Source</div>
        <div class="it-stage-items">
          <span
            v-for="(n, i) in SOURCE"
            :key="'s' + i"
            class="it-item"
            :class="{
              'it-item--active': sourceState(i) === 'active',
              'it-item--consumed':
                sourceState(i) === 'consumed' &&
                !(activeStage === 'source' && i === state.sourceIdx),
              'it-item--waiting': sourceState(i) === 'waiting',
            }"
            >{{ n }}</span
          >
        </div>
      </div>

      <div
        class="it-arrow"
        :class="{ 'it-arrow--active': stageActive('filter') || stageActive('source') }"
      >
        <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
          <path
            d="M2 10 L18 10 M14 5 L20 10 L14 15"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div
        class="it-stage"
        :class="{
          'it-stage--active': stageActive('filter'),
          'it-stage--reject': stageActive('filter-reject'),
        }"
      >
        <div class="it-stage-header">Filter <span class="it-stage-desc">(isOdd)</span></div>
        <div class="it-stage-items">
          <span v-for="n in state.filterPassed" :key="'fp' + n" class="it-item it-item--passed">{{
            n
          }}</span>
          <span
            v-for="n in state.filterRejected"
            :key="'fr' + n"
            class="it-item it-item--rejected"
            >{{ n }}</span
          >
          <span
            v-if="state.filterPassed.length === 0 && state.filterRejected.length === 0"
            class="it-item it-item--empty"
            >-</span
          >
        </div>
      </div>

      <div class="it-arrow" :class="{ 'it-arrow--active': stageActive('map') }">
        <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
          <path
            d="M2 10 L18 10 M14 5 L20 10 L14 15"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="it-stage" :class="{ 'it-stage--active': stageActive('map') }">
        <div class="it-stage-header">Map <span class="it-stage-desc">(*10)</span></div>
        <div class="it-stage-items">
          <span v-for="n in state.mapResults" :key="'m' + n" class="it-item it-item--mapped">{{
            n
          }}</span>
          <span v-if="state.mapResults.length === 0" class="it-item it-item--empty">-</span>
        </div>
      </div>

      <div class="it-arrow" :class="{ 'it-arrow--active': stageActive('take') }">
        <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
          <path
            d="M2 10 L18 10 M14 5 L20 10 L14 15"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="it-stage" :class="{ 'it-stage--active': stageActive('take') }">
        <div class="it-stage-header">
          Take <span class="it-stage-desc">({{ TAKE_COUNT }})</span>
        </div>
        <div class="it-stage-items">
          <span v-for="n in state.taken" :key="'t' + n" class="it-item it-item--taken">{{
            n
          }}</span>
          <span
            v-for="i in TAKE_COUNT - state.taken.length"
            :key="'te' + i"
            class="it-item it-item--slot"
            >?</span
          >
        </div>
      </div>

      <div class="it-arrow" :class="{ 'it-arrow--active': stageActive('collect') }">
        <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
          <path
            d="M2 10 L18 10 M14 5 L20 10 L14 15"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div
        class="it-stage it-stage--collect"
        :class="{ 'it-stage--active': stageActive('collect') }"
      >
        <div class="it-stage-header">Collect</div>
        <div class="it-stage-items">
          <span class="it-collected">[{{ state.collected.join(', ') || '...' }}]</span>
        </div>
      </div>
    </div>

    <!-- Active value indicator -->
    <div v-if="activeValue !== null" class="it-active-indicator">
      <span class="it-active-label">{{ t('Current value:', '当前值：') }}</span>
      <span class="it-active-val">{{ activeValue }}</span>
    </div>

    <div class="viz-controls">
      <button
        class="viz-btn viz-btn--primary"
        @click="pullNext"
        :disabled="state.done || animating"
      >
        {{ t('Pull Next', '拉取下一个') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetFullRun">{{ t('Auto Run', '自动运行') }}</button>
      <button class="viz-btn" @click="presetShortCircuit">{{ t('Short Circuit', '短路') }}</button>
      <button class="viz-btn" @click="presetStepByStep">{{ t('Step by Step', '逐步') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.it-stats {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.it-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.it-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.it-stat-value--success {
  color: var(--viz-success);
}

.it-stat-value--saved {
  color: var(--viz-muted);
}

.it-pipeline {
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  padding: 0.5rem 0;
}

.it-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem;
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  min-width: 64px;
  transition: all var(--viz-transition);
  flex-shrink: 0;
}

.it-stage--active {
  border-color: var(--viz-primary);
  box-shadow: 0 0 12px rgb(59 130 246 / 15%);
}

.it-stage--reject {
  border-color: var(--viz-danger);
  box-shadow: 0 0 12px rgb(239 68 68 / 12%);
}

.it-stage--collect {
  border-style: dashed;
}

.it-stage-header {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-text);
  white-space: nowrap;
}

.it-stage-desc {
  font-weight: 500;
  color: var(--viz-muted);
  text-transform: none;
}

.it-stage-items {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
  max-width: 80px;
}

.it-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  border: 1px solid var(--viz-border);
  transition: all var(--viz-transition);
}

.it-item--waiting {
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.it-item--active {
  background: var(--viz-primary);
  border-color: var(--viz-primary);
  color: #fff;
  animation: viz-pulse 0.4s ease;
}

.it-item--consumed {
  background: var(--viz-cell-empty);
  color: var(--viz-muted);
  opacity: 0.5;
}

.it-item--passed {
  background: rgb(16 185 129 / 12%);
  border-color: var(--viz-success);
  color: var(--viz-success);
}

.it-item--rejected {
  background: rgb(239 68 68 / 8%);
  border-color: var(--viz-danger);
  color: var(--viz-danger);
  text-decoration: line-through;
}

.it-item--mapped {
  background: rgb(59 130 246 / 10%);
  border-color: var(--viz-primary);
  color: var(--viz-primary);
  width: auto;
  min-width: 24px;
  padding: 0 3px;
}

.it-item--taken {
  background: var(--viz-success);
  border-color: var(--viz-success);
  color: #fff;
  width: auto;
  min-width: 24px;
  padding: 0 3px;
}

.it-item--slot {
  background: var(--vp-c-bg);
  color: var(--viz-muted);
  border-style: dashed;
}

.it-item--empty {
  background: none;
  border: none;
  color: var(--viz-muted);
}

.it-collected {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.it-arrow {
  display: flex;
  align-items: center;
  padding: 0 2px;
  color: var(--viz-border);
  transition: color var(--viz-transition);
  flex-shrink: 0;
  margin-top: 1.5rem;
}

.it-arrow--active {
  color: var(--viz-primary);
}

.it-active-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--viz-radius-sm);
  background: rgb(59 130 246 / 8%);
  border: 1px solid var(--viz-primary);
  margin: 0.5rem auto;
  width: fit-content;
  animation: viz-slide-in 0.2s ease;
}

.it-active-label {
  font-size: 0.6875rem;
  color: var(--viz-muted);
}

.it-active-val {
  font-size: 1rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-primary);
}

@media (width <= 640px) {
  .it-pipeline {
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }

  .it-arrow {
    margin-top: 0;
  }

  .it-arrow svg {
    width: 18px;
  }

  .it-stage {
    min-width: 56px;
    padding: 0.375rem;
  }

  .it-item {
    width: 20px;
    height: 20px;
    font-size: 0.6rem;
  }

  .it-stats {
    gap: 0.5rem;
  }

  .it-stat-value {
    font-size: 1rem;
  }
}
</style>
