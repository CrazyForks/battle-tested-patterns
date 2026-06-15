<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

/* ── Flyweight data model ── */

interface Flyweight {
  char: string;
  intrinsicSize: number;
}

interface CharInstance {
  id: number;
  char: string;
  position: number;
  hue: number;
}

const INTRINSIC_BYTES = 256;
const EXTRINSIC_BYTES = 16;

let nextId = 0;

const flyweightPool = ref<Map<string, Flyweight>>(new Map());
const instances = ref<CharInstance[]>([]);
const inputText = ref('Hello Flyweight');
const selectedChar = ref<string | null>(null);
const message = ref('');
const cacheHits = ref(0);
const cacheMisses = ref(0);
const lastAddedIds = ref<Set<number>>(new Set());
let presetRunning = false;

/* ── Time-travel history ── */
interface FlyweightSnapshot {
  pool: [string, Flyweight][];
  instances: CharInstance[];
  cacheHits: number;
  cacheMisses: number;
  lastAddedIds: number[];
}

const vizHistory = useVizHistory<FlyweightSnapshot>(
  { pool: [], instances: [], cacheHits: 0, cacheMisses: 0, lastAddedIds: [] },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      flyweightPool.value = new Map(snap.pool);
      instances.value = snap.instances;
      cacheHits.value = snap.cacheHits;
      cacheMisses.value = snap.cacheMisses;
      lastAddedIds.value = new Set(snap.lastAddedIds);
      selectedChar.value = null;
      if (msg !== undefined) message.value = msg;
    },
  },
);

/* ── Derived stats ── */

const totalInstances = computed(() => instances.value.length);
const uniqueCount = computed(() => flyweightPool.value.size);

const memoryWithout = computed(() => totalInstances.value * (INTRINSIC_BYTES + EXTRINSIC_BYTES));
const memoryWith = computed(
  () => uniqueCount.value * INTRINSIC_BYTES + totalInstances.value * EXTRINSIC_BYTES,
);
const memorySavedPct = computed(() => {
  if (memoryWithout.value === 0) return 0;
  return Math.round((1 - memoryWith.value / memoryWithout.value) * 100);
});

const hitRate = computed(() => {
  const total = cacheHits.value + cacheMisses.value;
  if (total === 0) return 0;
  return Math.round((cacheHits.value / total) * 100);
});

const usageCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const inst of instances.value) {
    counts[inst.char] = (counts[inst.char] || 0) + 1;
  }
  return counts;
});

/* ── Core flyweight logic ── */

function getOrCreateFlyweight(char: string): Flyweight {
  const existing = flyweightPool.value.get(char);
  if (existing) {
    cacheHits.value++;
    return existing;
  }
  cacheMisses.value++;
  const fw: Flyweight = { char, intrinsicSize: INTRINSIC_BYTES };
  flyweightPool.value.set(char, fw);
  return fw;
}

function processText(text: string) {
  const newIds = new Set<number>();
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    getOrCreateFlyweight(char);
    const id = nextId++;
    instances.value.push({
      id,
      char,
      position: instances.value.length,
      hue: (char.charCodeAt(0) * 47) % 360,
    });
    newIds.add(id);
  }
  lastAddedIds.value = newIds;
  safeTimeout(() => {
    lastAddedIds.value = new Set();
  }, 500);
}

/* ── User actions ── */

function applyText() {
  const text = inputText.value;
  if (!text) {
    message.value = t('Type something first.', '请先输入内容。');
    return;
  }
  flyweightPool.value = new Map();
  instances.value = [];
  cacheHits.value = 0;
  cacheMisses.value = 0;
  nextId = 0;
  selectedChar.value = null;

  processText(text);

  const unique = flyweightPool.value.size;
  const total = instances.value.length;
  message.value = t(
    `Processed ${total} characters with only ${unique} unique flyweight objects. Each glyph bitmap stored once — Java's String.intern() and Python's string interning work the same way.`,
    `处理了 ${total} 个字符，仅使用 ${unique} 个唯一的 Flyweight 对象。每个字形位图只存储一次 — Java 的 String.intern() 和 Python 的字符串驻留原理相同。`,
  );
  log(message.value, 'success');
  vizHistory.commit(
    {
      pool: [...flyweightPool.value.entries()],
      instances: instances.value,
      cacheHits: cacheHits.value,
      cacheMisses: cacheMisses.value,
      lastAddedIds: [...lastAddedIds.value],
    },
    `setText "${text}"`,
  );
}

function appendText() {
  const text = inputText.value;
  if (!text) {
    message.value = t('Type something to append.', '请输入要追加的内容。');
    return;
  }
  const poolBefore = flyweightPool.value.size;
  processText(text);
  const poolAfter = flyweightPool.value.size;
  const newFlyweights = poolAfter - poolBefore;

  if (newFlyweights === 0) {
    message.value = t(
      `Appended ${text.length} instances. All characters already in pool — 100% cache hit! This is the steady-state behavior.`,
      `追加了 ${text.length} 个实例。所有字符已在池中 — 100% 缓存命中！这是稳态行为。`,
    );
  } else {
    message.value = t(
      `Appended ${text.length} instances. ${newFlyweights} new flyweight(s) created, ${text.length - newFlyweights} reused.`,
      `追加了 ${text.length} 个实例。创建了 ${newFlyweights} 个新 Flyweight，复用了 ${text.length - newFlyweights} 个。`,
    );
  }
  vizHistory.commit(
    {
      pool: [...flyweightPool.value.entries()],
      instances: instances.value,
      cacheHits: cacheHits.value,
      cacheMisses: cacheMisses.value,
      lastAddedIds: [...lastAddedIds.value],
    },
    `append "${text}"`,
  );
}

function selectChar(char: string) {
  selectedChar.value = selectedChar.value === char ? null : char;
}

function reset() {
  clearAll();
  flyweightPool.value = new Map();
  instances.value = [];
  cacheHits.value = 0;
  cacheMisses.value = 0;
  nextId = 0;
  selectedChar.value = null;
  lastAddedIds.value = new Set();
  presetRunning = false;
  message.value = t('Reset. Type a sentence and click Apply.', '已重置。输入一句话并点击应用。');
  clearLog();
  vizHistory.reset();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function charColor(char: string): string {
  const hue = (char.charCodeAt(0) * 47) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

async function presetTextEditor() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  inputText.value = 'AAABBBCCC';
  message.value = t(
    'Text editor scenario: "AAABBBCCC" — 9 characters but only 3 unique glyphs. This is how text editors like VS Code render millions of characters with shared glyph atlases.',
    '文本编辑器场景："AAABBBCCC" — 9 个字符但只有 3 个唯一字形。VS Code 等文本编辑器就是用共享字形图集渲染数百万字符的。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  applyText();
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    `3 flyweights store 768B of glyph data. Without sharing: 9 copies = 2,304B. Saved ${memorySavedPct.value}%. Game engines use this for particle systems — millions of particles share one texture.`,
    `3 个 flyweight 存储 768B 字形数据。不共享：9 份 = 2,304B。节省 ${memorySavedPct.value}%。游戏引擎用此模式处理粒子系统 — 数百万粒子共享一个纹理。`,
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetHighRedundancy() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  inputText.value = 'aaaaaaaaaaaaaaaaaa';
  message.value = t(
    'Maximum redundancy: 18 instances of "a". One flyweight serves all 18 — this is the best case for flyweight pattern.',
    '最大冗余：18 个 "a" 实例。一个 flyweight 服务全部 18 个 — 这是 flyweight 模式的最佳场景。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  applyText();
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    `1 flyweight for 18 instances: ${memorySavedPct.value}% memory saved. CSS applies the same principle — one style rule shared across thousands of DOM elements.`,
    `1 个 flyweight 服务 18 个实例：节省 ${memorySavedPct.value}% 内存。CSS 应用相同原则 — 一条样式规则在数千个 DOM 元素间共享。`,
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetAppendDemo() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  inputText.value = 'Hello';
  message.value = t(
    'Append demo: apply "Hello", then append it again. Second time = 100% cache hits. This models how a document grows — early chars build the pool, later chars reuse it.',
    '追加演示：应用 "Hello"，然后再次追加。第二次 = 100% 缓存命中。这模拟文档增长 — 早期字符构建池，后续字符复用它。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  applyText();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  appendText();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    `After appending: ${totalInstances.value} instances, ${uniqueCount.value} flyweights, ${hitRate.value}% hit rate. The pool amortizes creation cost over the document's lifetime.`,
    `追加后：${totalInstances.value} 个实例，${uniqueCount.value} 个 flyweight，${hitRate.value}% 命中率。池在文档生命周期内摊销创建成本。`,
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

/* ── Initialize on mount ── */
applyText();
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Flyweight', '交互式 Flyweight') }}</div>

    <!-- Text input -->
    <div class="fw-input-row">
      <label class="viz-label" for="fw-input">{{ t('Text input:', '文本输入:') }}</label>
      <input
        id="fw-input"
        v-model="inputText"
        class="fw-input"
        type="text"
        :placeholder="t('Type a sentence...', '输入一句话...')"
        @keyup.enter="applyText"
      />
      <button class="viz-btn viz-btn--primary" @click="applyText">{{ t('Apply', '应用') }}</button>
      <button class="viz-btn" @click="appendText">{{ t('Append', '追加') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <!-- Stats panel -->
    <div class="fw-stats-panel">
      <div class="fw-stat-card">
        <div class="fw-stat-number">{{ totalInstances }}</div>
        <div class="fw-stat-desc">{{ t('Total Instances', '总实例数') }}</div>
      </div>
      <div class="fw-stat-card">
        <div class="fw-stat-number fw-stat-unique">{{ uniqueCount }}</div>
        <div class="fw-stat-desc">{{ t('Unique Flyweights', '唯一 Flyweight') }}</div>
      </div>
      <div class="fw-stat-card">
        <div class="fw-stat-number fw-stat-saved">{{ memorySavedPct }}%</div>
        <div class="fw-stat-desc">{{ t('Memory Saved', '内存节省') }}</div>
      </div>
      <div class="fw-stat-card">
        <div class="fw-stat-number" :class="hitRate >= 50 ? 'fw-stat-hit-good' : 'fw-stat-hit-low'">
          {{ hitRate }}%
        </div>
        <div class="fw-stat-desc">{{ t('Cache Hit Rate', '缓存命中率') }}</div>
      </div>
    </div>

    <!-- Memory comparison -->
    <div class="fw-memory-compare">
      <div class="fw-mem-col fw-mem-without">
        <div class="fw-mem-header">{{ t('Without Flyweight', '不使用 Flyweight') }}</div>
        <div class="fw-mem-bar-track">
          <div class="fw-mem-bar fw-mem-bar--waste" :style="{ width: '100%' }"></div>
        </div>
        <div class="fw-mem-detail">
          {{ totalInstances }} x ({{ INTRINSIC_BYTES }}+{{ EXTRINSIC_BYTES }}) =
          <strong>{{ formatBytes(memoryWithout) }}</strong>
        </div>
        <div class="fw-mem-note">
          {{ t('Each instance stores its own glyph data', '每个实例存储自己的字形数据') }}
        </div>
      </div>
      <div class="fw-mem-col fw-mem-with">
        <div class="fw-mem-header">{{ t('With Flyweight', '使用 Flyweight') }}</div>
        <div class="fw-mem-bar-track">
          <div
            class="fw-mem-bar fw-mem-bar--shared"
            :style="{ width: memoryWithout > 0 ? (memoryWith / memoryWithout) * 100 + '%' : '0%' }"
          ></div>
        </div>
        <div class="fw-mem-detail">
          {{ uniqueCount }} x {{ INTRINSIC_BYTES }} + {{ totalInstances }} x {{ EXTRINSIC_BYTES }} =
          <strong>{{ formatBytes(memoryWith) }}</strong>
        </div>
        <div class="fw-mem-note">
          {{
            t('Shared intrinsic + tiny extrinsic per instance', '共享内在数据 + 每实例微量外在数据')
          }}
        </div>
      </div>
    </div>

    <div class="fw-layout">
      <!-- Flyweight pool -->
      <div class="fw-pool">
        <div class="fw-section-label">
          {{ t('Flyweight Pool (intrinsic)', 'Flyweight 池（内在状态）') }}
        </div>
        <div class="fw-pool-grid">
          <div
            v-for="[char] in flyweightPool"
            :key="char"
            class="fw-pool-chip"
            :class="{
              'fw-pool-chip--selected': selectedChar === char,
            }"
            :style="{ borderColor: selectedChar === char ? charColor(char) : undefined }"
            role="button"
            :aria-pressed="selectedChar === char"
            tabindex="0"
            @click="selectChar(char)"
            @keydown.enter.prevent="selectChar(char)"
            @keydown.space.prevent="selectChar(char)"
          >
            <span class="fw-chip-char" :style="{ color: charColor(char) }">{{
              char === ' ' ? '␣' : char
            }}</span>
            <span class="fw-chip-count">{{ usageCounts[char] || 0 }}x</span>
          </div>
          <div v-if="flyweightPool.size === 0" class="fw-pool-empty">
            {{ t('Empty pool', '空池') }}
          </div>
        </div>
      </div>

      <!-- Instance grid -->
      <div class="fw-grid-section">
        <div class="fw-section-label">
          {{
            t(
              `Instances (extrinsic state) — click pool items to highlight`,
              `实例（外在状态）— 点击池中项目以高亮`,
            )
          }}
        </div>
        <div class="fw-grid">
          <div
            v-for="inst in instances"
            :key="inst.id"
            class="fw-grid-cell"
            :class="{
              'fw-grid-cell--highlight': selectedChar !== null && inst.char === selectedChar,
              'fw-grid-cell--dim': selectedChar !== null && inst.char !== selectedChar,
              'fw-grid-cell--new': lastAddedIds.has(inst.id),
            }"
            :style="{
              '--cell-color': charColor(inst.char),
              borderColor: selectedChar === inst.char ? charColor(inst.char) : undefined,
            }"
            :title="`#${inst.position} '${inst.char === ' ' ? 'space' : inst.char}' → flyweight@${inst.char.charCodeAt(0)}`"
            role="button"
            tabindex="0"
            @click="selectChar(inst.char)"
            @keydown.enter.prevent="selectChar(inst.char)"
            @keydown.space.prevent="selectChar(inst.char)"
          >
            {{ inst.char === ' ' ? '␣' : inst.char }}
          </div>
          <div v-if="instances.length === 0" class="fw-grid-empty">
            {{
              t('No instances yet. Type text and click Apply.', '暂无实例。输入文本并点击应用。')
            }}
          </div>
        </div>
        <div v-if="selectedChar !== null" class="fw-highlight-info">
          <span class="fw-highlight-char" :style="{ color: charColor(selectedChar) }">
            {{ selectedChar === ' ' ? '␣' : selectedChar }}
          </span>
          {{
            t(
              `${usageCounts[selectedChar] || 0} instances share 1 flyweight object (${INTRINSIC_BYTES} B shared, ${(usageCounts[selectedChar] || 0) * EXTRINSIC_BYTES} B extrinsic)`,
              `${usageCounts[selectedChar] || 0} 个实例共享 1 个 Flyweight 对象（共享 ${INTRINSIC_BYTES} B，外在 ${(usageCounts[selectedChar] || 0) * EXTRINSIC_BYTES} B）`,
            )
          }}
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetTextEditor">
        {{ t('Text Editor', '文本编辑器') }}
      </button>
      <button class="viz-btn" @click="presetHighRedundancy">
        {{ t('Max Redundancy', '最大冗余') }}
      </button>
      <button class="viz-btn" @click="presetAppendDemo">
        {{ t('Append Growth', '追加增长') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
/* ── Input row ── */
.fw-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.fw-input {
  flex: 1;
  min-width: 140px;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.15s;
}

.fw-input:focus {
  border-color: var(--viz-primary);
}

/* ── Stats panel ── */
.fw-stats-panel {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
}

@media (width <= 640px) {
  .fw-stats-panel {
    grid-template-columns: repeat(2, 1fr);
  }
}

.fw-stat-card {
  text-align: center;
  padding: 0.5rem 0.4rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
}

.fw-stat-number {
  font-size: 1.4rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  line-height: 1.2;
}

.fw-stat-unique {
  color: var(--viz-primary);
}

.fw-stat-saved {
  color: var(--viz-success);
}

.fw-stat-hit-good {
  color: var(--viz-success);
}

.fw-stat-hit-low {
  color: var(--viz-warning);
}

.fw-stat-desc {
  font-size: 0.65rem;
  color: var(--viz-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-top: 0.15rem;
}

/* ── Memory comparison ── */
.fw-memory-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

@media (width <= 640px) {
  .fw-memory-compare {
    grid-template-columns: 1fr;
  }
}

.fw-mem-col {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
}

.fw-mem-header {
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--viz-text);
}

.fw-mem-without .fw-mem-header {
  color: var(--viz-danger);
}

.fw-mem-with .fw-mem-header {
  color: var(--viz-success);
}

.fw-mem-bar-track {
  height: 10px;
  background: var(--vp-c-bg-soft);
  border-radius: var(--viz-radius-sm);
  overflow: hidden;
  margin-bottom: 0.35rem;
}

.fw-mem-bar {
  height: 100%;
  border-radius: var(--viz-radius-sm);
  transition: width var(--viz-transition);
}

.fw-mem-bar--waste {
  background: var(--viz-danger);
  opacity: 0.7;
}

.fw-mem-bar--shared {
  background: var(--viz-success);
  opacity: 0.8;
}

.fw-mem-detail {
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  margin-bottom: 0.2rem;
}

.fw-mem-detail strong {
  font-weight: 700;
}

.fw-mem-note {
  font-size: 0.65rem;
  color: var(--viz-muted);
}

/* ── Layout: pool + grid ── */
.fw-layout {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

@media (width <= 640px) {
  .fw-layout {
    flex-direction: column;
    align-items: stretch;
  }
}

.fw-section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--viz-muted);
  margin-bottom: 0.5rem;
}

/* ── Flyweight pool ── */
.fw-pool {
  flex: 0 0 auto;
  min-width: 140px;
  max-width: 220px;
}

.fw-pool-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.fw-pool-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0.2rem 0.45rem;
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  cursor: pointer;
  transition: all var(--viz-transition);
  font-size: 0.75rem;
}

.fw-pool-chip:hover {
  background: var(--vp-c-bg-soft);
}

.fw-pool-chip--selected {
  border-width: 2px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 0 0 1px var(--viz-primary);
}

.fw-chip-char {
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  min-width: 14px;
  text-align: center;
}

.fw-chip-count {
  font-size: 0.6rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.fw-pool-empty {
  font-size: 0.75rem;
  color: var(--viz-muted);
  padding: 0.5rem;
}

/* ── Instance grid ── */
.fw-grid-section {
  flex: 1;
  min-width: 0;
}

.fw-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  min-height: 60px;
  align-content: flex-start;
}

.fw-grid-cell {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  font-size: 0.8rem;
  border: 1.5px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg-soft);
  color: var(--cell-color, var(--viz-text));
  cursor: pointer;
  transition: all var(--viz-transition);
  user-select: none;
}

.fw-grid-cell:hover {
  transform: scale(1.15);
  z-index: 1;
}

.fw-grid-cell--highlight {
  border-color: var(--cell-color);
  box-shadow: 0 0 0 1px var(--cell-color);
  background: var(--vp-c-bg);
  transform: scale(1.05);
}

.fw-grid-cell--dim {
  opacity: 0.25;
}

.fw-grid-cell--new {
  animation: viz-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fw-grid-empty {
  width: 100%;
  text-align: center;
  color: var(--viz-muted);
  font-size: 0.8rem;
  padding: 1rem 0;
}

.fw-highlight-info {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: var(--viz-text);
  padding: 0.3rem 0.5rem;
  border: 1px dashed var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg-soft);
}

.fw-highlight-char {
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  font-size: 1rem;
  margin-right: 0.3rem;
}
</style>
