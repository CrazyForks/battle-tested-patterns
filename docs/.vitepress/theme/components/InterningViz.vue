<script setup lang="ts">
import { ref, computed } from 'vue';

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
const message = ref('Click "Intern" to add strings to the pool');
const highlightValue = ref('');
let entryIdCounter = 0;
let varIdCounter = 0;
let varNameCounter = 0;

const presetStrings = [
  'hello', 'world', 'foo', 'bar', 'hello', 'baz',
  'world', 'hello', 'qux', 'foo', 'bar', 'world',
];
let presetIndex = 0;

const varNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];

const uniqueCount = computed(() => pool.value.length);
const totalRefs = computed(() => variables.value.length);

function intern() {
  const str = presetStrings[presetIndex % presetStrings.length];
  presetIndex++;
  const varName = varNames[varNameCounter % varNames.length];
  varNameCounter++;

  const existing = pool.value.find(e => e.value === str);
  if (existing) {
    variables.value.push({
      name: varName,
      targetValue: str,
      id: ++varIdCounter,
    });
    highlightValue.value = str;
    message.value = `intern("${str}") -> reused existing entry, assigned to ${varName}`;
  } else {
    pool.value.push({ value: str, id: ++entryIdCounter });
    variables.value.push({
      name: varName,
      targetValue: str,
      id: ++varIdCounter,
    });
    highlightValue.value = str;
    message.value = `intern("${str}") -> new entry added to pool, assigned to ${varName}`;
  }
  setTimeout(() => { highlightValue.value = ''; }, 600);
}

function reset() {
  pool.value = [];
  variables.value = [];
  message.value = 'Pool cleared';
  highlightValue.value = '';
  presetIndex = 0;
  varNameCounter = 0;
}

function refsForEntry(value: string): VarRef[] {
  return variables.value.filter(v => v.targetValue === value);
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive String Interning</div>

    <div class="in-stats">
      <span class="in-stat">unique strings: <strong>{{ uniqueCount }}</strong></span>
      <span class="in-stat">total references: <strong>{{ totalRefs }}</strong></span>
    </div>

    <div class="in-layout">
      <!-- Variables column -->
      <div class="in-section">
        <div class="in-section-header">Variables</div>
        <div class="in-vars">
          <div
            v-for="v in variables"
            :key="v.id"
            class="in-var"
            :class="{ 'in-var--highlight': highlightValue === v.targetValue }"
          >
            <span class="in-var-name">{{ v.name }}</span>
            <svg class="in-ref-arrow" viewBox="0 0 28 12" width="28" height="12">
              <path d="M0 6 L22 6 M18 2 L22 6 L18 10" stroke="var(--viz-primary)" stroke-width="1.5" fill="none"/>
            </svg>
            <span class="in-var-target">"{{ v.targetValue }}"</span>
          </div>
          <div v-if="variables.length === 0" class="in-empty">No variables yet</div>
        </div>
      </div>

      <!-- Pool column -->
      <div class="in-section">
        <div class="in-section-header">Intern Pool</div>
        <div class="in-pool">
          <div
            v-for="entry in pool"
            :key="entry.id"
            class="in-entry"
            :class="{ 'in-entry--highlight': highlightValue === entry.value }"
          >
            <span class="in-entry-value">"{{ entry.value }}"</span>
            <span class="in-entry-refs">
              {{ refsForEntry(entry.value).length }} ref{{ refsForEntry(entry.value).length !== 1 ? 's' : '' }}
            </span>
          </div>
          <div v-if="pool.length === 0" class="in-empty">Pool is empty</div>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="intern">
        Intern("{{ presetStrings[presetIndex % presetStrings.length] }}")
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">Reset</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.in-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
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

.in-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
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

.in-vars {
  padding: 0.375rem 0.5rem;
  max-height: 220px;
  overflow-y: auto;
}

.in-var {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.25rem;
  border-radius: 4px;
  transition: background 0.3s;
}

.in-var--highlight {
  background: rgba(59, 130, 246, 0.1);
}

.in-var-name {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  min-width: 1rem;
}

.in-ref-arrow {
  flex-shrink: 0;
}

.in-var-target {
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-primary);
}

.in-pool {
  padding: 0.375rem 0.5rem;
  max-height: 220px;
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

.in-entry--highlight {
  border-color: var(--viz-success);
  background: rgba(16, 185, 129, 0.08);
  animation: in-pulse 0.5s ease;
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

.in-empty {
  padding: 0.75rem 0.25rem;
  color: var(--viz-muted);
  font-size: 0.75rem;
  font-style: italic;
}

@keyframes in-pulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

@media (max-width: 640px) {
  .in-layout {
    grid-template-columns: 1fr;
  }
}
</style>
