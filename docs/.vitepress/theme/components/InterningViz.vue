<script setup lang="ts">
import { ref, computed, reactive, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

/* ── Data model ──────────────────────────────── */
interface InternEntry {
  value: string;
  id: number;
}

interface VarRef {
  name: string;
  targetValue: string;
  id: number;
}

const pool = ref<InternEntry[]>([]);
const variables = ref<VarRef[]>([]);
const message = ref(t(
  'Type a string and click "Intern" to add it to the pool',
  '输入字符串并点击 "Intern" 将其添加到池中',
));
const highlightValue = ref('');
const highlightAction = ref<'new' | 'reuse' | 'remove' | 'gc' | ''>('');
const inputText = ref('');
let entryIdCounter = 0;
let varIdCounter = 0;
let varNameCounter = 0;
const pendingTimers = new Set<ReturnType<typeof setTimeout | typeof setInterval>>();

onUnmounted(() => {
  for (const id of pendingTimers) clearTimeout(id);
  pendingTimers.clear();
});

const varNames = 'abcdefghijklmnopqrstuvwxyz'.split('');

/* ── Comparison demo state ───────────────────── */
const compareA = ref<VarRef | null>(null);
const compareB = ref<VarRef | null>(null);
const compareResult = ref('');
const compareSteps = reactive<string[]>([]);
const comparingCharIdx = ref(-1);
const isComparing = ref(false);

/* ── Computed stats ──────────────────────────── */
const uniqueCount = computed(() => pool.value.length);
const totalRefs = computed(() => variables.value.length);

/** Approximate bytes saved: each duplicate ref avoids storing the string again */
const memorySaved = computed(() => {
  let saved = 0;
  for (const entry of pool.value) {
    const refCount = refsForEntry(entry.value).length;
    if (refCount > 1) {
      // Each extra reference saves the full string bytes
      saved += (refCount - 1) * entry.value.length * 2; // 2 bytes per char (UTF-16)
    }
  }
  return saved;
});

const memorySavingsDetail = computed(() => {
  const details: Array<{ value: string; refs: number; saved: number }> = [];
  for (const entry of pool.value) {
    const refCount = refsForEntry(entry.value).length;
    if (refCount > 1) {
      details.push({
        value: entry.value,
        refs: refCount,
        saved: (refCount - 1) * entry.value.length * 2,
      });
    }
  }
  return details;
});

/* ── Preset strings for quick add ────────────── */
const presetStrings = ['hello', 'world', 'foo', 'bar'];

/* ── Core operations ─────────────────────────── */
function intern(str?: string) {
  const val = (str ?? inputText.value.trim());
  if (!val) {
    message.value = t('Enter a string first', '请先输入一个字符串');
    return;
  }

  const varName = varNames[varNameCounter % varNames.length];
  varNameCounter++;

  const existing = pool.value.find(e => e.value === val);
  if (existing) {
    variables.value.push({
      name: varName,
      targetValue: val,
      id: ++varIdCounter,
    });
    highlightValue.value = val;
    highlightAction.value = 'reuse';
    message.value = t(
      `intern("${val}") -> reused existing pool entry, assigned to ${varName}`,
      `intern("${val}") -> 复用已有池条目，赋值给 ${varName}`,
    );
  } else {
    pool.value.push({ value: val, id: ++entryIdCounter });
    variables.value.push({
      name: varName,
      targetValue: val,
      id: ++varIdCounter,
    });
    highlightValue.value = val;
    highlightAction.value = 'new';
    message.value = t(
      `intern("${val}") -> NEW entry added to pool, assigned to ${varName}`,
      `intern("${val}") -> 新条目已添加到池中，赋值给 ${varName}`,
    );
  }
  inputText.value = '';
  {
    const tid = setTimeout(() => { pendingTimers.delete(tid); highlightValue.value = ''; highlightAction.value = ''; }, 700);
    pendingTimers.add(tid);
  }
}

function removeVariable(v: VarRef) {
  const idx = variables.value.findIndex(x => x.id === v.id);
  if (idx === -1) return;
  variables.value.splice(idx, 1);

  const remaining = refsForEntry(v.targetValue).length;
  highlightValue.value = v.targetValue;
  highlightAction.value = 'remove';

  // Clear compare slots if removed var was selected
  if (compareA.value?.id === v.id) compareA.value = null;
  if (compareB.value?.id === v.id) compareB.value = null;

  if (remaining === 0) {
    // GC: remove from pool
    const poolIdx = pool.value.findIndex(e => e.value === v.targetValue);
    if (poolIdx !== -1) {
      pool.value.splice(poolIdx, 1);
      highlightAction.value = 'gc';
      message.value = t(
        `Removed ${v.name}. refcount("${v.targetValue}") = 0 -> GC'd from pool`,
        `已移除 ${v.name}。refcount("${v.targetValue}") = 0 -> 已从池中回收`,
      );
    }
  } else {
    message.value = t(
      `Removed ${v.name}. refcount("${v.targetValue}") = ${remaining}`,
      `已移除 ${v.name}。refcount("${v.targetValue}") = ${remaining}`,
    );
  }
  {
    const tid = setTimeout(() => { pendingTimers.delete(tid); highlightValue.value = ''; highlightAction.value = ''; }, 700);
    pendingTimers.add(tid);
  }
}

function reset() {
  pool.value = [];
  variables.value = [];
  message.value = t('Pool cleared', '池已清空');
  highlightValue.value = '';
  highlightAction.value = '';
  inputText.value = '';
  varNameCounter = 0;
  compareA.value = null;
  compareB.value = null;
  compareResult.value = '';
  compareSteps.length = 0;
  comparingCharIdx.value = -1;
  isComparing.value = false;
}

function refsForEntry(value: string): VarRef[] {
  return variables.value.filter(v => v.targetValue === value);
}

/* ── Comparison demo ─────────────────────────── */
function selectForCompare(v: VarRef) {
  if (isComparing.value) return;
  if (!compareA.value) {
    compareA.value = v;
    compareResult.value = '';
    compareSteps.length = 0;
    message.value = t(
      `Selected ${v.name} as first operand. Click another variable as second.`,
      `已选择 ${v.name} 作为第一操作数。点击另一个变量作为第二操作数。`,
    );
  } else if (compareA.value.id === v.id) {
    // Deselect
    compareA.value = null;
    compareResult.value = '';
    message.value = t('Comparison cancelled', '比较已取消');
  } else {
    compareB.value = v;
    runComparison();
  }
}

function runComparison() {
  if (!compareA.value || !compareB.value) return;
  const a = compareA.value;
  const b = compareB.value;

  isComparing.value = true;
  compareSteps.length = 0;
  compareResult.value = '';
  comparingCharIdx.value = -1;

  const sameInterned = a.targetValue === b.targetValue;

  // Step 1: pointer comparison (instant)
  compareSteps.push(t(
    `Step 1: Pointer check — do ${a.name} and ${b.name} reference the same pool entry?`,
    `步骤 1：指针检查 — ${a.name} 和 ${b.name} 是否引用同一池条目？`,
  ));

  const outerTid = setTimeout(() => {
    pendingTimers.delete(outerTid);
    if (sameInterned) {
      compareSteps.push(t(
        `-> YES! Both point to "${a.targetValue}" in pool. O(1) — done!`,
        `-> 是！两者均指向池中的 "${a.targetValue}"。O(1) — 完成！`,
      ));
      compareResult.value = t(
        `${a.name} === ${b.name} is TRUE (same interned reference, O(1))`,
        `${a.name} === ${b.name} 为 TRUE（相同的 intern 引用，O(1)）`,
      );
      isComparing.value = false;
    } else {
      compareSteps.push(t(
        `-> NO. ${a.name} -> "${a.targetValue}", ${b.name} -> "${b.targetValue}". Different pool entries.`,
        `-> 否。${a.name} -> "${a.targetValue}"，${b.name} -> "${b.targetValue}"。不同池条目。`,
      ));
      compareSteps.push(t(
        `Step 2: Without interning, would need char-by-char comparison O(n):`,
        `步骤 2：若无 interning，需逐字符比较 O(n)：`,
      ));

      // Animate character-by-character comparison
      const maxLen = Math.max(a.targetValue.length, b.targetValue.length);
      let charIdx = 0;
      const charInterval = setInterval(() => {
        if (charIdx >= maxLen) {
          clearInterval(charInterval); pendingTimers.delete(charInterval);
          comparingCharIdx.value = -1;
          compareResult.value = t(
            `${a.name} !== ${b.name} (different values, needed ${maxLen} char comparisons without interning)`,
            `${a.name} !== ${b.name}（不同值，若无 interning 需要 ${maxLen} 次字符比较）`,
          );
          isComparing.value = false;
          return;
        }
        comparingCharIdx.value = charIdx;
        const chA = a.targetValue[charIdx] ?? '-';
        const chB = b.targetValue[charIdx] ?? '-';
        if (chA !== chB) {
          compareSteps.push(t(
            `  [${charIdx}] '${chA}' != '${chB}' -> mismatch found after ${charIdx + 1} comparison(s)`,
            `  [${charIdx}] '${chA}' != '${chB}' -> 在 ${charIdx + 1} 次比较后发现不匹配`,
          ));
          clearInterval(charInterval); pendingTimers.delete(charInterval);
          comparingCharIdx.value = -1;
          compareResult.value = t(
            `${a.name} !== ${b.name} (mismatch at index ${charIdx}, O(n) without interning)`,
            `${a.name} !== ${b.name}（在索引 ${charIdx} 处不匹配，无 interning 则 O(n)）`,
          );
          isComparing.value = false;
          return;
        }
        compareSteps.push(t(
          `  [${charIdx}] '${chA}' == '${chB}' -> match, continue...`,
          `  [${charIdx}] '${chA}' == '${chB}' -> 匹配，继续...`,
        ));
        charIdx++;
      }, 350);
      pendingTimers.add(charInterval);
    }
  }, 500);
  pendingTimers.add(outerTid);
}

function clearCompare() {
  compareA.value = null;
  compareB.value = null;
  compareResult.value = '';
  compareSteps.length = 0;
  comparingCharIdx.value = -1;
  isComparing.value = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive String Interning', '交互式字符串 Interning') }}</div>

    <!-- Stats bar -->
    <div class="in-stats">
      <span class="in-stat">
        {{ t('pool size', '池大小') }}: <strong>{{ uniqueCount }}</strong>
      </span>
      <span class="in-stat">
        {{ t('references', '引用数') }}: <strong>{{ totalRefs }}</strong>
      </span>
      <span class="in-stat in-stat--saved" v-if="memorySaved > 0">
        {{ t('saved', '已节省') }}: <strong>{{ memorySaved }}B</strong>
      </span>
    </div>

    <!-- Input controls -->
    <div class="in-input-row">
      <input
        v-model="inputText"
        class="in-input"
        :placeholder="t('Type a string...', '输入字符串...')"
        @keyup.enter="intern()"
        :disabled="isComparing"
      />
      <button class="viz-btn viz-btn--primary" @click="intern()" :disabled="isComparing">
        {{ t('Intern', 'Intern') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="in-presets">
      <span class="viz-label">{{ t('Quick add:', '快速添加：') }}&nbsp;</span>
      <button
        v-for="ps in presetStrings"
        :key="ps"
        class="in-preset-btn"
        @click="intern(ps)"
        :disabled="isComparing"
      >
        "{{ ps }}"
      </button>
    </div>

    <!-- Main layout: Variables + Pool -->
    <div class="in-layout">
      <!-- Variables column -->
      <div class="in-section">
        <div class="in-section-header">{{ t('Variables', '变量') }}</div>
        <div class="in-vars">
          <div
            v-for="v in variables"
            :key="v.id"
            class="in-var"
            :class="{
              'in-var--highlight-new': highlightValue === v.targetValue && highlightAction === 'new',
              'in-var--highlight-reuse': highlightValue === v.targetValue && highlightAction === 'reuse',
              'in-var--highlight-remove': highlightValue === v.targetValue && highlightAction === 'remove',
              'in-var--compare-selected': compareA?.id === v.id || compareB?.id === v.id,
            }"
          >
            <span class="in-var-name">{{ v.name }}</span>
            <svg class="in-ref-arrow" viewBox="0 0 28 12" width="28" height="12">
              <path d="M0 6 L22 6 M18 2 L22 6 L18 10" stroke="var(--viz-primary)" stroke-width="1.5" fill="none"/>
            </svg>
            <span class="in-var-target">"{{ v.targetValue }}"</span>
            <button
              class="in-var-action in-var-action--compare"
              :title="t('Compare', '比较')"
              @click="selectForCompare(v)"
              :disabled="isComparing"
            >
              ==
            </button>
            <button
              class="in-var-action in-var-action--remove"
              :title="t('Remove reference', '移除引用')"
              @click="removeVariable(v)"
              :disabled="isComparing"
            >
              &times;
            </button>
          </div>
          <div v-if="variables.length === 0" class="in-empty">
            {{ t('No variables yet — intern a string above', '暂无变量 — 请在上方 intern 一个字符串') }}
          </div>
        </div>
      </div>

      <!-- Pool column -->
      <div class="in-section">
        <div class="in-section-header">{{ t('Intern Pool', 'Intern 池') }}</div>
        <div class="in-pool">
          <div
            v-for="entry in pool"
            :key="entry.id"
            class="in-entry"
            :class="{
              'in-entry--highlight-new': highlightValue === entry.value && highlightAction === 'new',
              'in-entry--highlight-reuse': highlightValue === entry.value && highlightAction === 'reuse',
              'in-entry--highlight-remove': highlightValue === entry.value && highlightAction === 'remove',
            }"
          >
            <span class="in-entry-value">"{{ entry.value }}"</span>
            <span class="in-entry-refs" :class="{
              'in-entry-refs--warn': refsForEntry(entry.value).length === 1,
            }">
              {{ refsForEntry(entry.value).length }} {{ t(refsForEntry(entry.value).length !== 1 ? 'refs' : 'ref', '个引用') }}
            </span>
          </div>
          <div v-if="pool.length === 0" class="in-empty">
            {{ t('Pool is empty', '池为空') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Memory savings detail -->
    <div v-if="memorySavingsDetail.length > 0" class="in-savings">
      <div class="in-savings-title">{{ t('Memory Savings', '内存节省') }}</div>
      <div v-for="d in memorySavingsDetail" :key="d.value" class="in-savings-row">
        <span class="in-savings-label">"{{ d.value }}"</span>
        <span class="in-savings-detail">
          {{ d.refs }} {{ t('refs', '个引用') }} &rarr;
          {{ t('stored once', '存储一次') }},
          {{ t(`saved ${d.refs - 1} copies`, `节省 ${d.refs - 1} 份副本`) }}
          <strong>({{ d.saved }}B)</strong>
        </span>
      </div>
    </div>

    <!-- Comparison demo -->
    <div v-if="compareA || compareSteps.length" class="in-compare">
      <div class="in-compare-header">
        <span class="in-compare-title">{{ t('Equality Comparison', '等值比较') }}</span>
        <button class="in-compare-clear" @click="clearCompare" v-if="!isComparing">
          {{ t('Clear', '清除') }}
        </button>
      </div>

      <div class="in-compare-operands">
        <div class="in-compare-slot" :class="{ 'in-compare-slot--filled': compareA }">
          {{ compareA ? `${compareA.name} = "${compareA.targetValue}"` : t('Click == on a variable', '点击变量上的 ==') }}
        </div>
        <span class="in-compare-vs">vs</span>
        <div class="in-compare-slot" :class="{ 'in-compare-slot--filled': compareB }">
          {{ compareB ? `${compareB.name} = "${compareB.targetValue}"` : t('Click == on another', '点击另一个变量的 ==') }}
        </div>
      </div>

      <div v-if="compareSteps.length" class="in-compare-steps">
        <div
          v-for="(step, i) in compareSteps"
          :key="i"
          class="in-compare-step"
          :class="{
            'in-compare-step--heading': step.startsWith('Step') || step.startsWith('步骤'),
            'in-compare-step--match': step.includes('match') || step.includes('匹配'),
            'in-compare-step--mismatch': step.includes('mismatch') || step.includes('不匹配') || step.includes('!='),
            'in-compare-step--success': step.includes('YES') || step.includes('是！'),
            'in-compare-step--fail': step.includes('NO.') || step.includes('否。'),
          }"
        >{{ step }}</div>
      </div>

      <div v-if="compareResult" class="in-compare-result" :class="{
        'in-compare-result--equal': compareResult.includes('TRUE'),
        'in-compare-result--not-equal': compareResult.includes('!=='),
      }">
        {{ compareResult }}
      </div>
    </div>

    <!-- Status message -->
    <div class="viz-status" :class="{
      'in-status--new': highlightAction === 'new',
      'in-status--reuse': highlightAction === 'reuse',
      'in-status--remove': highlightAction === 'remove',
      'in-status--gc': highlightAction === 'gc',
    }">{{ message }}</div>
  </div>
</template>

<style scoped>
/* ── Stats ──────────────────────────────── */
.in-stats {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.in-stat {
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
}

.in-stat strong {
  color: var(--viz-primary);
}

.in-stat--saved strong {
  color: var(--viz-success);
}

/* ── Input row ──────────────────────────── */
.in-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.in-input {
  flex: 1;
  min-width: 120px;
  max-width: 220px;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.in-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

/* ── Presets ─────────────────────────────── */
.in-presets {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.in-preset-btn {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 4px;
  background: transparent;
  color: var(--viz-muted);
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  cursor: pointer;
  transition: all 0.15s ease;
}

.in-preset-btn:hover:not(:disabled) {
  color: var(--viz-primary);
  border-color: var(--viz-primary);
}

.in-preset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Main layout ────────────────────────── */
.in-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.in-section {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.in-section-header {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.375rem 0.625rem;
  background: var(--viz-border);
  color: var(--viz-text);
}

/* ── Variables ───────────────────────────── */
.in-vars {
  padding: 0.375rem 0.5rem;
  max-height: 260px;
  overflow-y: auto;
}

.in-var {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.25rem;
  border-radius: 4px;
  transition: background 0.3s;
}

.in-var--highlight-new {
  background: rgba(59, 130, 246, 0.12);
  animation: in-pulse 0.5s ease;
}

.in-var--highlight-reuse {
  background: rgba(16, 185, 129, 0.12);
  animation: in-pulse 0.5s ease;
}

.in-var--highlight-remove {
  background: rgba(239, 68, 68, 0.1);
}

.in-var--compare-selected {
  outline: 2px solid var(--viz-warning);
  outline-offset: 1px;
  border-radius: 4px;
}

.in-var-name {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  min-width: 0.875rem;
}

.in-ref-arrow {
  flex-shrink: 0;
}

.in-var-target {
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.in-var-action {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--viz-border);
  border-radius: 3px;
  background: transparent;
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
  line-height: 1;
}

.in-var-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.in-var-action--compare {
  color: var(--viz-warning);
}

.in-var-action--compare:hover:not(:disabled) {
  background: var(--viz-warning);
  color: #fff;
  border-color: var(--viz-warning);
}

.in-var-action--remove {
  color: var(--viz-danger);
  font-size: 0.875rem;
}

.in-var-action--remove:hover:not(:disabled) {
  background: var(--viz-danger);
  color: #fff;
  border-color: var(--viz-danger);
}

/* ── Pool ────────────────────────────────── */
.in-pool {
  padding: 0.375rem 0.5rem;
  max-height: 260px;
  overflow-y: auto;
}

.in-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.4rem;
  margin-bottom: 2px;
  border: 1px solid var(--viz-border);
  border-radius: 4px;
  transition: all 0.3s;
}

.in-entry--highlight-new {
  border-color: var(--viz-primary);
  background: rgba(59, 130, 246, 0.08);
  animation: in-pulse 0.5s ease;
}

.in-entry--highlight-reuse {
  border-color: var(--viz-success);
  background: rgba(16, 185, 129, 0.08);
  animation: in-pulse 0.5s ease;
}

.in-entry--highlight-remove {
  border-color: var(--viz-danger);
  background: rgba(239, 68, 68, 0.06);
}

.in-entry-value {
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.in-entry-refs {
  font-size: 0.6875rem;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
}

.in-entry-refs--warn {
  color: var(--viz-warning);
}

.in-empty {
  padding: 0.75rem 0.25rem;
  color: var(--viz-muted);
  font-size: 0.75rem;
  font-style: italic;
}

/* ── Memory savings ──────────────────────── */
.in-savings {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  background: var(--vp-c-bg);
}

.in-savings-title {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-success);
  margin-bottom: 0.375rem;
}

.in-savings-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  padding: 0.125rem 0;
  flex-wrap: wrap;
}

.in-savings-label {
  color: var(--viz-text);
  font-weight: 600;
}

.in-savings-detail {
  color: var(--viz-muted);
}

.in-savings-detail strong {
  color: var(--viz-success);
}

/* ── Comparison demo ─────────────────────── */
.in-compare {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  background: var(--vp-c-bg);
}

.in-compare-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.in-compare-title {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-warning);
}

.in-compare-clear {
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--viz-border);
  border-radius: 3px;
  background: transparent;
  color: var(--viz-muted);
  font-size: 0.625rem;
  cursor: pointer;
  transition: all 0.15s;
}

.in-compare-clear:hover {
  color: var(--viz-danger);
  border-color: var(--viz-danger);
}

.in-compare-operands {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
  flex-wrap: wrap;
}

.in-compare-slot {
  flex: 1;
  min-width: 100px;
  padding: 0.25rem 0.5rem;
  border: 1px dashed var(--viz-border);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  text-align: center;
}

.in-compare-slot--filled {
  border-style: solid;
  border-color: var(--viz-warning);
  color: var(--viz-text);
  background: rgba(245, 158, 11, 0.06);
}

.in-compare-vs {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--viz-muted);
}

.in-compare-steps {
  border-top: 1px solid var(--viz-border);
  padding-top: 0.375rem;
  margin-top: 0.25rem;
}

.in-compare-step {
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  padding: 0.1rem 0;
  white-space: pre-wrap;
}

.in-compare-step--heading {
  color: var(--viz-text);
  font-weight: 600;
}

.in-compare-step--success {
  color: var(--viz-success);
}

.in-compare-step--fail {
  color: var(--viz-danger);
}

.in-compare-step--mismatch {
  color: var(--viz-danger);
}

.in-compare-result {
  margin-top: 0.375rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
}

.in-compare-result--equal {
  background: rgba(16, 185, 129, 0.1);
  color: var(--viz-success);
  border: 1px solid var(--viz-success);
}

.in-compare-result--not-equal {
  background: rgba(239, 68, 68, 0.08);
  color: var(--viz-danger);
  border: 1px solid var(--viz-danger);
}

/* ── Status modifiers ────────────────────── */
.in-status--new { border-left: 3px solid var(--viz-primary); }
.in-status--reuse { border-left: 3px solid var(--viz-success); }
.in-status--remove { border-left: 3px solid var(--viz-warning); }
.in-status--gc { border-left: 3px solid var(--viz-danger); }

/* ── Animations ──────────────────────────── */
@keyframes in-pulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

/* ── Mobile ──────────────────────────────── */
@media (max-width: 640px) {
  .in-layout {
    grid-template-columns: 1fr;
  }

  .in-input {
    max-width: none;
  }

  .in-compare-operands {
    flex-direction: column;
    align-items: stretch;
  }

  .in-compare-vs {
    text-align: center;
  }

  .in-compare-slot {
    min-width: auto;
  }

  .in-savings-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
  }
}
</style>
