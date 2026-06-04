<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const SOURCE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TAKE_COUNT = 3;

// Pipeline: Source -> Filter(odd) -> Map(*10) -> Take(3) -> Collect
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
const message = ref(t('Click "Pull Next" to pull one element through the lazy pipeline', '点击"拉取下一个"将一个元素拉过惰性管道'));

const hasNext = computed(() => !state.done && state.sourceIdx < SOURCE.length - 1);

let aborted = false;
onUnmounted(() => { aborted = true; });

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pullNext() {
  if (state.done || animating.value) return;

  if (state.taken.length >= TAKE_COUNT) {
    state.done = true;
    message.value = t(`Take(${TAKE_COUNT}) satisfied! Pipeline complete. Only ${state.elementsProcessed} of ${SOURCE.length} source elements were touched.`, `Take(${TAKE_COUNT}) 已满足！管道完成。仅访问了 ${SOURCE.length} 个源元素中的 ${state.elementsProcessed} 个。`);
    activeStage.value = null;
    activeValue.value = null;
    return;
  }

  animating.value = true;

  // We need to find the next element that passes through all stages
  while (state.sourceIdx < SOURCE.length - 1 && state.taken.length < TAKE_COUNT) {
    // Stage 1: Source - pull next element
    state.sourceIdx++;
    state.elementsProcessed++;
    const val = SOURCE[state.sourceIdx];

    activeStage.value = 'source';
    activeValue.value = val;
    message.value = t(`Source: pulling element ${val}`, `Source：拉取元素 ${val}`);
    await delay(400);
    if (aborted) return;

    // Stage 2: Filter - keep only odd numbers
    activeStage.value = 'filter';
    message.value = t(`Filter(isOdd): checking ${val}...`, `Filter(isOdd)：检查 ${val}...`);
    await delay(400);
    if (aborted) return;

    if (val % 2 === 0) {
      // Rejected by filter
      state.filterRejected = [...state.filterRejected, val];
      activeStage.value = 'filter-reject';
      message.value = t(`Filter: ${val} is even -> rejected. Pulling next from source...`, `Filter：${val} 是偶数 -> 已过滤。从 Source 拉取下一个...`);
      await delay(300);
      if (aborted) return;
      continue; // Pull next from source
    }

    // Passed filter
    state.filterPassed = [...state.filterPassed, val];
    message.value = t(`Filter: ${val} is odd -> passed!`, `Filter：${val} 是奇数 -> 通过！`);
    await delay(300);
    if (aborted) return;

    // Stage 3: Map - multiply by 10
    activeStage.value = 'map';
    const mapped = val * 10;
    message.value = t(`Map(*10): ${val} -> ${mapped}`, `Map(*10)：${val} -> ${mapped}`);
    activeValue.value = mapped;
    await delay(400);
    if (aborted) return;
    state.mapResults = [...state.mapResults, mapped];

    // Stage 4: Take
    activeStage.value = 'take';
    message.value = t(`Take(${TAKE_COUNT}): collected ${state.taken.length + 1} of ${TAKE_COUNT}`, `Take(${TAKE_COUNT})：已收集 ${state.taken.length + 1}/${TAKE_COUNT}`);
    await delay(300);
    if (aborted) return;
    state.taken = [...state.taken, mapped];

    // Stage 5: Collect
    activeStage.value = 'collect';
    state.collected = [...state.collected, mapped];
    message.value = t(`Collected: [${state.collected.join(', ')}]`, `已收集：[${state.collected.join(', ')}]`);
    await delay(300);
    if (aborted) return;

    break; // One element pulled through successfully
  }

  if (state.taken.length >= TAKE_COUNT) {
    state.done = true;
    message.value = t(`Pipeline complete! Result: [${state.collected.join(', ')}]. Processed ${state.elementsProcessed} of ${SOURCE.length} elements (laziness saved ${SOURCE.length - state.elementsProcessed}!)`, `管道完成！结果：[${state.collected.join(', ')}]。处理了 ${SOURCE.length} 个元素中的 ${state.elementsProcessed} 个（惰性求值节省了 ${SOURCE.length - state.elementsProcessed} 个！）`);
  } else if (state.sourceIdx >= SOURCE.length - 1 && state.taken.length < TAKE_COUNT) {
    state.done = true;
    message.value = t(`Source exhausted. Got [${state.collected.join(', ')}] (${state.taken.length} of ${TAKE_COUNT} requested)`, `Source 已耗尽。获得 [${state.collected.join(', ')}]（请求 ${TAKE_COUNT} 个，实际 ${state.taken.length} 个）`);
  }

  activeStage.value = null;
  activeValue.value = null;
  animating.value = false;
}

function reset() {
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
  message.value = t('Reset. Click "Pull Next" to start pulling elements lazily.', '已重置。点击"拉取下一个"开始惰性拉取元素。');
}

function stageActive(name: string): boolean {
  return activeStage.value === name;
}

function sourceState(idx: number): string {
  if (idx === state.sourceIdx && activeStage.value === 'source') return 'active';
  if (idx <= state.sourceIdx) return 'consumed';
  return 'waiting';
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Lazy Iterator Pipeline', '交互式惰性 Iterator 管道') }}</div>

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
        <span class="it-stat-value it-stat-value--saved">{{ SOURCE.length - state.elementsProcessed }}</span>
        <span class="viz-label">{{ t('Never Touched', '未访问') }}</span>
      </div>
    </div>

    <!-- Pipeline stages -->
    <div class="it-pipeline">
      <!-- Source -->
      <div class="it-stage" :class="{ 'it-stage--active': stageActive('source') }">
        <div class="it-stage-header">Source</div>
        <div class="it-stage-items">
          <span
            v-for="(n, i) in SOURCE"
            :key="'s' + i"
            class="it-item"
            :class="{
              'it-item--active': sourceState(i) === 'active',
              'it-item--consumed': sourceState(i) === 'consumed' && !(activeStage === 'source' && i === state.sourceIdx),
              'it-item--waiting': sourceState(i) === 'waiting',
            }"
          >{{ n }}</span>
        </div>
      </div>

      <div class="it-arrow" :class="{ 'it-arrow--active': stageActive('filter') || stageActive('source') }">
        <svg width="24" height="20" viewBox="0 0 24 20">
          <path d="M2 10 L18 10 M14 5 L20 10 L14 15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Filter -->
      <div class="it-stage" :class="{ 'it-stage--active': stageActive('filter'), 'it-stage--reject': stageActive('filter-reject') }">
        <div class="it-stage-header">Filter <span class="it-stage-desc">(isOdd)</span></div>
        <div class="it-stage-items">
          <span v-for="n in state.filterPassed" :key="'fp' + n" class="it-item it-item--passed">{{ n }}</span>
          <span v-for="n in state.filterRejected" :key="'fr' + n" class="it-item it-item--rejected">{{ n }}</span>
          <span v-if="state.filterPassed.length === 0 && state.filterRejected.length === 0" class="it-item it-item--empty">-</span>
        </div>
      </div>

      <div class="it-arrow" :class="{ 'it-arrow--active': stageActive('map') }">
        <svg width="24" height="20" viewBox="0 0 24 20">
          <path d="M2 10 L18 10 M14 5 L20 10 L14 15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Map -->
      <div class="it-stage" :class="{ 'it-stage--active': stageActive('map') }">
        <div class="it-stage-header">Map <span class="it-stage-desc">(*10)</span></div>
        <div class="it-stage-items">
          <span v-for="n in state.mapResults" :key="'m' + n" class="it-item it-item--mapped">{{ n }}</span>
          <span v-if="state.mapResults.length === 0" class="it-item it-item--empty">-</span>
        </div>
      </div>

      <div class="it-arrow" :class="{ 'it-arrow--active': stageActive('take') }">
        <svg width="24" height="20" viewBox="0 0 24 20">
          <path d="M2 10 L18 10 M14 5 L20 10 L14 15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Take -->
      <div class="it-stage" :class="{ 'it-stage--active': stageActive('take') }">
        <div class="it-stage-header">Take <span class="it-stage-desc">({{ TAKE_COUNT }})</span></div>
        <div class="it-stage-items">
          <span v-for="n in state.taken" :key="'t' + n" class="it-item it-item--taken">{{ n }}</span>
          <span v-for="i in (TAKE_COUNT - state.taken.length)" :key="'te' + i" class="it-item it-item--slot">?</span>
        </div>
      </div>

      <div class="it-arrow" :class="{ 'it-arrow--active': stageActive('collect') }">
        <svg width="24" height="20" viewBox="0 0 24 20">
          <path d="M2 10 L18 10 M14 5 L20 10 L14 15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Collect -->
      <div class="it-stage it-stage--collect" :class="{ 'it-stage--active': stageActive('collect') }">
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
      <button class="viz-btn viz-btn--primary" @click="pullNext" :disabled="state.done || animating">{{ t('Pull Next', '拉取下一个') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
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

.it-stat-value--success { color: var(--viz-success); }
.it-stat-value--saved { color: var(--viz-muted); }

/* Pipeline layout */
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
  border-radius: 8px;
  background: var(--vp-c-bg);
  min-width: 64px;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.it-stage--active {
  border-color: var(--viz-primary);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.15);
}

.it-stage--reject {
  border-color: var(--viz-danger);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.12);
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
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  border: 1px solid var(--viz-border);
  transition: all 0.2s ease;
}

.it-item--waiting {
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.it-item--active {
  background: var(--viz-primary);
  border-color: var(--viz-primary);
  color: #fff;
  animation: it-pulse 0.4s ease;
}

.it-item--consumed {
  background: var(--viz-cell-empty);
  color: var(--viz-muted);
  opacity: 0.5;
}

.it-item--passed {
  background: rgba(16, 185, 129, 0.12);
  border-color: var(--viz-success);
  color: var(--viz-success);
}

.it-item--rejected {
  background: rgba(239, 68, 68, 0.08);
  border-color: var(--viz-danger);
  color: var(--viz-danger);
  text-decoration: line-through;
}

.it-item--mapped {
  background: rgba(59, 130, 246, 0.1);
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
  transition: color 0.2s ease;
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
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid var(--viz-primary);
  margin: 0.5rem auto;
  width: fit-content;
  animation: it-appear 0.2s ease;
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

.viz-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes it-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

@keyframes it-appear {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
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
