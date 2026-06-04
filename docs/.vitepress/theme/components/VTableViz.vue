<script setup lang="ts">
import { ref, computed, reactive, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

let aborted = false;
onUnmounted(() => {
  aborted = true;
});

interface VTableEntry {
  methodName: string;
  implLabel: string;
  output: string;
  overridden: boolean;
}

interface ClassDef {
  name: string;
  color: string;
  vtable: VTableEntry[];
}

const methods = ['speak()', 'move()', 'eat()'] as const;
type MethodName = (typeof methods)[number];

const classes: ClassDef[] = [
  {
    name: 'Animal',
    color: 'var(--viz-muted)',
    vtable: [
      { methodName: 'speak()', implLabel: 'Animal::speak', output: '"..."', overridden: false },
      { methodName: 'move()', implLabel: 'Animal::move', output: '"moves"', overridden: false },
      { methodName: 'eat()', implLabel: 'Animal::eat', output: '"eats"', overridden: false },
    ],
  },
  {
    name: 'Dog',
    color: 'var(--viz-success)',
    vtable: [
      { methodName: 'speak()', implLabel: 'Dog::speak', output: '"Woof!"', overridden: true },
      { methodName: 'move()', implLabel: 'Dog::move', output: '"bounds"', overridden: true },
      { methodName: 'eat()', implLabel: 'Animal::eat', output: '"eats"', overridden: false },
    ],
  },
  {
    name: 'Cat',
    color: 'var(--viz-primary)',
    vtable: [
      { methodName: 'speak()', implLabel: 'Cat::speak', output: '"Meow!"', overridden: true },
      { methodName: 'move()', implLabel: 'Cat::move', output: '"slinks"', overridden: true },
      { methodName: 'eat()', implLabel: 'Cat::eat', output: '"nibbles"', overridden: true },
    ],
  },
  {
    name: 'Bird',
    color: 'var(--viz-warning)',
    vtable: [
      { methodName: 'speak()', implLabel: 'Bird::speak', output: '"Tweet!"', overridden: true },
      { methodName: 'move()', implLabel: 'Bird::move', output: '"flies"', overridden: true },
      { methodName: 'eat()', implLabel: 'Animal::eat', output: '"eats"', overridden: false },
    ],
  },
];

const subclasses = computed(() => classes.filter(c => c.name !== 'Animal'));

// User selections
const selectedClassName = ref('Dog');
const selectedMethod = ref<MethodName>('speak()');

// Animation state
const dispatching = ref(false);
const activeStep = ref(0); // 0=idle, 1=obj, 2=vptr, 3=vtable-lookup, 4=result
const dispatchResult = ref('');
const dispatchOutput = ref('');
const message = ref(
  t(
    'Select an object and method, then click "Call Method" to see vtable dispatch',
    '选择对象和方法，然后点击「调用方法」查看 vtable 分派',
  ),
);

// Dispatch history
const history = reactive<{ obj: string; method: string; impl: string; output: string }[]>([]);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getClassDef(name: string): ClassDef {
  return classes.find(c => c.name === name)!;
}

function getClassColor(name: string): string {
  return getClassDef(name).color;
}

const selectedClass = computed(() => getClassDef(selectedClassName.value));

const selectedEntry = computed(() =>
  selectedClass.value.vtable.find(e => e.methodName === selectedMethod.value)!,
);

async function callMethod() {
  if (dispatching.value) return;
  dispatching.value = true;
  dispatchResult.value = '';
  dispatchOutput.value = '';

  const cls = selectedClass.value;
  const entry = selectedEntry.value;
  const objLabel = selectedClassName.value.toLowerCase() + '1';

  // Step 1: highlight the object
  activeStep.value = 1;
  message.value = t(
    `${objLabel}.${selectedMethod.value} called -- reading vptr from the object...`,
    `${objLabel}.${selectedMethod.value} 被调用 -- 从对象读取 vptr...`,
  );
  await delay(800);
  if (aborted) return;

  // Step 2: follow vptr to vtable
  activeStep.value = 2;
  message.value = t(
    `vptr points to ${cls.name}'s vtable`,
    `vptr 指向 ${cls.name} 的 vtable`,
  );
  await delay(800);
  if (aborted) return;

  // Step 3: look up method in vtable
  activeStep.value = 3;
  message.value = t(
    `Looking up ${selectedMethod.value} in ${cls.name} vtable...`,
    `在 ${cls.name} vtable 中查找 ${selectedMethod.value}...`,
  );
  await delay(800);
  if (aborted) return;

  // Step 4: show the dispatch result
  activeStep.value = 4;
  dispatchResult.value = entry.implLabel;
  dispatchOutput.value = entry.output;
  const inheritNote = entry.overridden
    ? t('(overridden)', '(已重写)')
    : t('(inherited from Animal)', '(继承自 Animal)');
  message.value = t(
    `Dispatched to ${entry.implLabel} ${inheritNote} -- returns ${entry.output}`,
    `分派到 ${entry.implLabel} ${inheritNote} -- 返回 ${entry.output}`,
  );

  // Record in history
  history.push({
    obj: objLabel,
    method: selectedMethod.value,
    impl: entry.implLabel,
    output: entry.output,
  });
  if (history.length > 6) {
    history.splice(0, history.length - 6);
  }

  await delay(1500);
  if (aborted) return;

  // Reset animation (keep result and history visible)
  activeStep.value = 0;
  dispatching.value = false;
}

function reset() {
  dispatching.value = false;
  activeStep.value = 0;
  dispatchResult.value = '';
  dispatchOutput.value = '';
  selectedClassName.value = 'Dog';
  selectedMethod.value = 'speak()';
  history.splice(0);
  message.value = t(
    'Select an object and method, then click "Call Method" to see vtable dispatch',
    '选择对象和方法，然后点击「调用方法」查看 vtable 分派',
  );
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive VTable Dispatch', '交互式 VTable 分派') }}</div>

    <!-- Controls row -->
    <div class="vt-controls">
      <div class="vt-control-group">
        <label class="vt-label">{{ t('Object:', '对象：') }}</label>
        <select v-model="selectedClassName" :disabled="dispatching" class="vt-select">
          <option v-for="cls in subclasses" :key="cls.name" :value="cls.name">
            {{ cls.name.toLowerCase() }}1 : {{ cls.name }}
          </option>
        </select>
      </div>

      <div class="vt-control-group">
        <label class="vt-label">{{ t('Method:', '方法：') }}</label>
        <div class="vt-method-btns">
          <button
            v-for="m in methods"
            :key="m"
            class="vt-method-btn"
            :class="{ 'vt-method-btn--selected': m === selectedMethod }"
            :disabled="dispatching"
            @click="selectedMethod = m"
          >{{ m }}</button>
        </div>
      </div>

      <button
        class="viz-btn viz-btn--primary vt-call-btn"
        :disabled="dispatching"
        @click="callMethod"
      >
        {{ dispatching ? t('Dispatching...', '分派中...') : t('Call Method', '调用方法') }}
      </button>
    </div>

    <!-- Main visualization -->
    <div class="vt-layout">
      <!-- Object column -->
      <div class="vt-col">
        <div class="vt-col-label">{{ t('Object', '对象') }}</div>
        <div
          class="vt-obj"
          :class="{ 'vt-obj-active': activeStep >= 1 }"
          :style="{ borderColor: activeStep >= 1 ? getClassColor(selectedClassName) : undefined }"
        >
          <div class="vt-obj-name">{{ selectedClassName.toLowerCase() }}1</div>
          <div class="vt-obj-type" :style="{ color: getClassColor(selectedClassName) }">
            : {{ selectedClassName }}
          </div>
          <div class="vt-obj-vptr">
            vptr
            <span class="vt-arrow" :class="{ 'vt-arrow-lit': activeStep >= 2 }">&#x2192;</span>
          </div>
          <div v-if="activeStep >= 1" class="vt-obj-call">
            <span class="vt-call-text">.{{ selectedMethod }}</span>
          </div>
        </div>
      </div>

      <!-- Arrow column -->
      <div class="vt-arrow-col">
        <span
          class="vt-ptr-line"
          :class="{ 'vt-ptr-lit': activeStep >= 2 }"
        >&#x2500;&#x2500;&#x25B6;</span>
      </div>

      <!-- VTable column -->
      <div class="vt-col">
        <div class="vt-col-label">{{ t('VTable', 'VTable') }}</div>
        <div
          class="vt-vtable"
          :class="{ 'vt-vtable-active': activeStep >= 2 }"
          :style="{ borderColor: activeStep >= 2 ? getClassColor(selectedClassName) : undefined }"
        >
          <div class="vt-vtable-header" :style="{ background: getClassColor(selectedClassName) }">
            {{ selectedClassName }} vtable
          </div>
          <div
            v-for="entry in selectedClass.vtable"
            :key="entry.methodName"
            class="vt-vtable-row"
            :class="{
              'vt-row-hit': activeStep >= 3 && entry.methodName === selectedMethod,
            }"
          >
            <span class="vt-method-name">{{ entry.methodName }}</span>
            <span class="vt-method-ptr">&#x2192;</span>
            <span class="vt-method-impl">{{ entry.implLabel }}</span>
            <span v-if="!entry.overridden" class="vt-inherited-badge">
              {{ t('inherited', '继承') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Resolution arrow -->
      <div class="vt-arrow-col">
        <span
          class="vt-ptr-line"
          :class="{ 'vt-ptr-lit': activeStep >= 4 }"
        >&#x2500;&#x2500;&#x25B6;</span>
      </div>

      <!-- Function column -->
      <div class="vt-col">
        <div class="vt-col-label">{{ t('Function', '函数') }}</div>
        <div
          class="vt-func"
          :class="{ 'vt-func-active': activeStep >= 4 }"
        >
          <div class="vt-func-name">{{ activeStep >= 4 ? dispatchResult : '???' }}</div>
          <div v-if="activeStep >= 4" class="vt-func-output">
            {{ t('returns', '返回') }} {{ dispatchOutput }}
          </div>
        </div>
      </div>
    </div>

    <!-- Dispatch chain diagram -->
    <div class="vt-chain">
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 1 }">
        {{ t('object', '对象') }}
      </span>
      <span class="vt-chain-arrow" :class="{ 'vt-step-active': activeStep >= 2 }">&#x2192;</span>
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 2 }">
        vptr
      </span>
      <span class="vt-chain-arrow" :class="{ 'vt-step-active': activeStep >= 3 }">&#x2192;</span>
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 3 }">
        vtable[{{ selectedMethod }}]
      </span>
      <span class="vt-chain-arrow" :class="{ 'vt-step-active': activeStep >= 4 }">&#x2192;</span>
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 4 }">
        {{ activeStep >= 4 ? dispatchResult : t('function', '函数') }}
      </span>
    </div>

    <!-- Dispatch result -->
    <div v-if="dispatchResult && activeStep >= 4" class="vt-result">
      <span class="vt-result-label">{{ t('Result:', '结果：') }}</span>
      <span class="vt-result-value">{{ dispatchResult }} {{ t('returns', '返回') }} {{ dispatchOutput }}</span>
      <span v-if="!selectedEntry.overridden" class="vt-result-note">
        {{ t('(inherited -- not overridden by ', '(继承 -- 未被 ') }}{{ selectedClassName }}{{ t(' )', ' 重写)') }}
      </span>
    </div>

    <!-- All VTables comparison -->
    <details class="vt-details">
      <summary class="vt-summary">{{ t('Compare All VTables', '对比所有 VTable') }}</summary>
      <div class="vt-compare">
        <div v-for="cls in classes" :key="cls.name" class="vt-compare-table">
          <div class="vt-vtable-header" :style="{ background: cls.color }">
            {{ cls.name }} vtable
          </div>
          <div
            v-for="entry in cls.vtable"
            :key="entry.methodName"
            class="vt-vtable-row"
            :class="{ 'vt-row-overridden': entry.overridden }"
          >
            <span class="vt-method-name">{{ entry.methodName }}</span>
            <span class="vt-method-ptr">&#x2192;</span>
            <span class="vt-method-impl">{{ entry.implLabel }}</span>
            <span v-if="cls.name !== 'Animal' && !entry.overridden" class="vt-inherited-badge">
              {{ t('inherited', '继承') }}
            </span>
          </div>
        </div>
      </div>
    </details>

    <!-- History -->
    <div v-if="history.length > 0" class="vt-history">
      <div class="vt-history-title">{{ t('Dispatch History', '分派历史') }}</div>
      <div class="vt-history-list">
        <div v-for="(h, i) in history" :key="i" class="vt-history-item">
          <span class="vt-history-call">{{ h.obj }}.{{ h.method }}</span>
          <span class="vt-history-arrow">&#x2192;</span>
          <span class="vt-history-impl">{{ h.impl }}</span>
          <span class="vt-history-arrow">&#x2192;</span>
          <span class="vt-history-output">{{ h.output }}</span>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
/* --- Controls --- */
.vt-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  flex-wrap: wrap;
}

.vt-control-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.vt-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--viz-text);
  white-space: nowrap;
}

.vt-select {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--viz-text);
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.vt-select:focus {
  border-color: var(--viz-primary);
}

.vt-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vt-method-btns {
  display: flex;
  gap: 4px;
}

.vt-method-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--viz-text);
  cursor: pointer;
  transition: all 0.15s;
}

.vt-method-btn:hover:not(:disabled) {
  border-color: var(--viz-primary);
  color: var(--viz-primary);
}

.vt-method-btn--selected {
  background: var(--viz-primary);
  color: #fff;
  border-color: var(--viz-primary);
}

.vt-method-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vt-call-btn {
  margin-left: auto;
}

/* --- Layout --- */
.vt-layout {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 0;
  overflow-x: auto;
}

.vt-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.vt-col-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  letter-spacing: 0.05em;
  padding-bottom: 2px;
}

/* --- Object --- */
.vt-obj {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.65rem;
  border: 2px solid var(--viz-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  transition: border-color 0.25s, box-shadow 0.25s;
  min-width: 110px;
}

.vt-obj-active {
  box-shadow: 0 0 14px rgba(59, 130, 246, 0.25);
}

.vt-obj-name {
  font-size: 0.82rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.vt-obj-type {
  font-size: 0.72rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
}

.vt-obj-vptr {
  font-size: 0.65rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  margin-top: 2px;
}

.vt-arrow {
  transition: color 0.2s;
}

.vt-arrow-lit {
  color: var(--viz-warning);
  font-weight: 700;
}

.vt-obj-call {
  margin-top: 4px;
  animation: vt-flash 0.35s ease;
}

.vt-call-text {
  font-size: 0.72rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 700;
  color: var(--viz-primary);
  background: rgba(59, 130, 246, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
}

/* --- Arrow column --- */
.vt-arrow-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 26px;
  min-height: 80px;
}

.vt-ptr-line {
  font-size: 0.9rem;
  color: var(--viz-border);
  transition: color 0.2s;
  font-family: var(--vp-font-family-mono);
}

.vt-ptr-lit {
  color: var(--viz-warning);
  animation: vt-flash 0.5s ease;
}

/* --- VTable --- */
.vt-vtable {
  border: 2px solid var(--viz-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg);
  transition: border-color 0.25s, box-shadow 0.25s;
  min-width: 170px;
}

.vt-vtable-active {
  box-shadow: 0 0 14px rgba(59, 130, 246, 0.25);
}

.vt-vtable-header {
  padding: 0.3rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
  font-family: var(--vp-font-family-mono);
}

.vt-vtable-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.3rem 0.5rem;
  border-top: 1px solid var(--viz-border);
  font-size: 0.68rem;
  font-family: var(--vp-font-family-mono);
  transition: background 0.25s, color 0.25s;
}

.vt-row-hit {
  background: var(--viz-warning);
  color: #fff;
}

.vt-row-hit .vt-method-name,
.vt-row-hit .vt-method-ptr,
.vt-row-hit .vt-method-impl,
.vt-row-hit .vt-inherited-badge {
  color: #fff;
}

.vt-row-overridden {
  /* subtle indicator in the comparison view */
}

.vt-method-name {
  font-weight: 700;
  color: var(--viz-text);
}

.vt-method-ptr {
  color: var(--viz-muted);
}

.vt-method-impl {
  color: var(--viz-primary);
  font-weight: 600;
}

.vt-inherited-badge {
  font-size: 0.55rem;
  color: var(--viz-muted);
  font-style: italic;
  margin-left: auto;
}

/* --- Function result --- */
.vt-func {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0.5rem 0.65rem;
  border: 2px dashed var(--viz-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  transition: border-color 0.25s, box-shadow 0.25s;
  min-width: 110px;
  min-height: 60px;
  justify-content: center;
  align-items: center;
}

.vt-func-active {
  border-color: var(--viz-success);
  border-style: solid;
  box-shadow: 0 0 14px rgba(34, 197, 94, 0.25);
  animation: vt-flash 0.4s ease;
}

.vt-func-name {
  font-size: 0.78rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  text-align: center;
}

.vt-func-output {
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-success);
  font-weight: 700;
}

/* --- Dispatch result --- */
.vt-result {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 0.7rem;
  margin: 0.5rem 0;
  border: 2px solid var(--viz-success);
  border-radius: 8px;
  background: var(--vp-c-bg);
  animation: vt-flash 0.4s ease;
  flex-wrap: wrap;
}

.vt-result-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-success);
}

.vt-result-value {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.vt-result-note {
  font-size: 0.65rem;
  color: var(--viz-muted);
  font-style: italic;
}

/* --- Dispatch chain --- */
.vt-chain {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 0;
  flex-wrap: wrap;
  justify-content: center;
}

.vt-chain-step {
  padding: 0.25rem 0.5rem;
  border: 2px solid var(--viz-border);
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  background: var(--vp-c-bg);
  transition: all 0.2s;
}

.vt-chain-arrow {
  font-size: 0.9rem;
  color: var(--viz-border);
  transition: color 0.2s;
}

.vt-step-active {
  color: var(--viz-warning);
  border-color: var(--viz-warning);
}

/* --- Comparison view --- */
.vt-details {
  margin: 0.75rem 0;
}

.vt-summary {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--viz-primary);
  cursor: pointer;
  padding: 0.3rem 0;
  user-select: none;
}

.vt-summary:hover {
  text-decoration: underline;
}

.vt-compare {
  display: flex;
  gap: 8px;
  padding: 0.5rem 0;
  overflow-x: auto;
}

.vt-compare-table {
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  overflow: hidden;
  min-width: 150px;
  flex-shrink: 0;
}

/* --- History --- */
.vt-history {
  margin: 0.5rem 0;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.vt-history-title {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.vt-history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.vt-history-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-family: var(--vp-font-family-mono);
}

.vt-history-call {
  color: var(--viz-text);
  font-weight: 600;
}

.vt-history-arrow {
  color: var(--viz-muted);
}

.vt-history-impl {
  color: var(--viz-primary);
  font-weight: 600;
}

.vt-history-output {
  color: var(--viz-success);
  font-weight: 700;
}

@keyframes vt-flash {
  0% { opacity: 0.4; }
  100% { opacity: 1; }
}

@media (max-width: 640px) {
  .vt-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .vt-call-btn {
    margin-left: 0;
  }

  .vt-layout {
    flex-direction: column;
    align-items: stretch;
  }

  .vt-arrow-col {
    flex-direction: row;
    justify-content: center;
    padding-top: 0;
    min-height: auto;
  }

  .vt-arrow-col .vt-ptr-line {
    transform: rotate(90deg);
  }

  .vt-compare {
    flex-direction: column;
  }
}
</style>
