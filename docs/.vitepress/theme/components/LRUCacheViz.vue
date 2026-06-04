<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
onUnmounted(() => { for (const tid of pendingTimers) clearTimeout(tid); });

const CAPACITY = 4;

interface CacheEntry {
  key: string;
  value: string;
  id: number;
}

const entries = ref<CacheEntry[]>([]);
const message = ref(t('Try get("A") or put("A","1") to start', '试试 get("A") 或 put("A","1") 开始'));
const animKey = ref('');
const animAction = ref<'hit' | 'miss' | 'evict' | 'insert' | ''>('');
const inputKey = ref('');
const inputValue = ref('');
let idCounter = 0;

const presets: [string, string][] = [
  ['A', '1'], ['B', '2'], ['C', '3'], ['D', '4'], ['E', '5'],
];
let presetIndex = 0;

function put(key?: string, value?: string) {
  const k = key ?? inputKey.value.trim().toUpperCase();
  const v = value ?? inputValue.value.trim();
  if (!k) { message.value = t('Enter a key first', '请先输入键'); return; }
  const val = v || String(++presetIndex);

  const existIdx = entries.value.findIndex(e => e.key === k);
  if (existIdx >= 0) {
    entries.value.splice(existIdx, 1);
    entries.value.unshift({ key: k, value: val, id: ++idCounter });
    animKey.value = k;
    animAction.value = 'hit';
    message.value = t(`put("${k}", "${val}") → key exists, moved to front`, `put("${k}", "${val}") → 键已存在，移至头部`);
  } else {
    if (entries.value.length >= CAPACITY) {
      const evicted = entries.value.pop()!;
      animKey.value = evicted.key;
      animAction.value = 'evict';
      message.value = t(`put("${k}", "${val}") → evicted "${evicted.key}", inserted at front`, `put("${k}", "${val}") → 淘汰 "${evicted.key}"，插入头部`);
    } else {
      message.value = t(`put("${k}", "${val}") → inserted at front`, `put("${k}", "${val}") → 插入头部`);
    }
    entries.value.unshift({ key: k, value: val, id: ++idCounter });
    const tid1 = setTimeout(() => { pendingTimers.delete(tid1); animKey.value = k; animAction.value = 'insert'; }, 50);
    pendingTimers.add(tid1);
  }
  inputKey.value = '';
  inputValue.value = '';
  const tid2 = setTimeout(() => { pendingTimers.delete(tid2); animKey.value = ''; animAction.value = ''; }, 500);
  pendingTimers.add(tid2);
}

function get(key?: string) {
  const k = key ?? inputKey.value.trim().toUpperCase();
  if (!k) { message.value = t('Enter a key first', '请先输入键'); return; }

  const idx = entries.value.findIndex(e => e.key === k);
  if (idx >= 0) {
    const entry = entries.value.splice(idx, 1)[0];
    entries.value.unshift(entry);
    animKey.value = k;
    animAction.value = 'hit';
    message.value = t(`get("${k}") → HIT! value="${entry.value}", moved to front`, `get("${k}") → 命中！value="${entry.value}"，移至头部`);
  } else {
    animKey.value = k;
    animAction.value = 'miss';
    message.value = t(`get("${k}") → MISS! key not in cache`, `get("${k}") → 未命中！键不在缓存中`);
  }
  inputKey.value = '';
  const tid3 = setTimeout(() => { pendingTimers.delete(tid3); animKey.value = ''; animAction.value = ''; }, 500);
  pendingTimers.add(tid3);
}

function quickPut() {
  const [k, v] = presets[presetIndex % presets.length];
  presetIndex++;
  put(k, v);
}

function reset() {
  entries.value = [];
  message.value = t('Cache cleared!', '缓存已清空！');
  animKey.value = '';
  animAction.value = '';
  presetIndex = 0;
}

const emptySlots = computed(() => Math.max(0, CAPACITY - entries.value.length));
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive LRU Cache', '交互式 LRU Cache') }} · {{ t('capacity', '容量') }}={{ CAPACITY }}</div>

    <!-- Visual: Doubly Linked List -->
    <div class="lru-chain">
      <div class="lru-label lru-label--mru">MRU</div>
      <template v-for="(entry, i) in entries" :key="entry.id">
        <div
          class="lru-node"
          :class="{
            'lru-node--hit': animKey === entry.key && animAction === 'hit',
            'lru-node--insert': animKey === entry.key && animAction === 'insert',
          }"
        >
          <div class="lru-node-key">{{ entry.key }}</div>
          <div class="lru-node-val">{{ entry.value }}</div>
        </div>
        <svg v-if="i < entries.length - 1 || emptySlots > 0" class="lru-arrow" viewBox="0 0 24 12" width="24" height="12">
          <path d="M0 6 L18 6 M14 2 L18 6 L14 10" stroke="var(--viz-muted)" stroke-width="1.5" fill="none"/>
        </svg>
      </template>
      <template v-for="j in emptySlots" :key="'empty-' + j">
        <div class="lru-node lru-node--empty">
          <div class="lru-node-key">-</div>
          <div class="lru-node-val">&nbsp;</div>
        </div>
        <svg v-if="j < emptySlots" class="lru-arrow" viewBox="0 0 24 12" width="24" height="12">
          <path d="M0 6 L18 6 M14 2 L18 6 L14 10" stroke="var(--viz-border)" stroke-width="1.5" fill="none"/>
        </svg>
      </template>
      <div class="lru-label lru-label--lru">LRU</div>
    </div>

    <!-- Controls -->
    <div class="lru-control-row">
      <div class="lru-input-group">
        <input v-model="inputKey" class="lru-input" :placeholder="t('Key', '键')" maxlength="3" @keyup.enter="put()" />
        <input v-model="inputValue" class="lru-input" :placeholder="t('Val', '值')" maxlength="4" @keyup.enter="put()" />
      </div>
      <div class="viz-controls" style="margin-top: 0">
        <button class="viz-btn viz-btn--primary" @click="put()">Put</button>
        <button class="viz-btn" @click="get()">Get</button>
        <button class="viz-btn" @click="quickPut">{{ t('Auto Put', '自动 Put') }}</button>
        <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      </div>
    </div>

    <div class="viz-status" :class="{
      'viz-status--hit': animAction === 'hit',
      'viz-status--miss': animAction === 'miss',
      'viz-status--evict': animAction === 'evict',
    }">{{ message }}</div>
  </div>
</template>

<style scoped>
.lru-chain {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem 0;
  overflow-x: auto;
  flex-wrap: nowrap;
}

.lru-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  padding: 0 0.25rem;
}

.lru-label--mru { color: var(--viz-success); }
.lru-label--lru { color: var(--viz-danger); }

.lru-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 48px;
  border: 2px solid var(--viz-primary);
  border-radius: 6px;
  padding: 0.375rem 0.5rem;
  background: var(--vp-c-bg);
  transition: all 0.3s ease;
}

.lru-node--empty {
  border-color: var(--viz-border);
  border-style: dashed;
  opacity: 0.5;
}

.lru-node--hit {
  animation: node-highlight 0.5s ease;
  border-color: var(--viz-success);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
}

.lru-node--insert {
  animation: node-slide-in 0.4s ease;
}

.lru-node-key {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.lru-node-val {
  font-size: 0.6875rem;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
}

.lru-arrow {
  flex-shrink: 0;
}

.lru-control-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.lru-input-group {
  display: flex;
  gap: 0.375rem;
}

.lru-input {
  width: 56px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  text-align: center;
  text-transform: uppercase;
}

.lru-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

.viz-status--hit { border-left: 3px solid var(--viz-success); }
.viz-status--miss { border-left: 3px solid var(--viz-danger); }
.viz-status--evict { border-left: 3px solid var(--viz-warning); }

@keyframes node-highlight {
  0% { transform: scale(1); }
  40% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes node-slide-in {
  0% { opacity: 0; transform: translateY(-12px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
