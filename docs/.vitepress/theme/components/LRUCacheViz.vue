<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { safeTimeout, clearAll, speed } = useVizTimers();

const CAPACITY = 4;

interface CacheEntry {
  key: string;
  value: string;
  id: number;
}

const entries = ref<CacheEntry[]>([]);
const message = ref(t('Try get("A") or put("A","1") — or pick a preset scenario below', '试试 get("A") 或 put("A","1") — 或选择下方的预设场景'));
const animKey = ref('');
const animAction = ref<'hit' | 'miss' | 'evict' | 'insert' | ''>('');
const inputKey = ref('');
const inputValue = ref('');
let idCounter = 0;
let presetRunning = false;

function put(key?: string, value?: string) {
  const k = key ?? inputKey.value.trim().toUpperCase();
  const v = value ?? inputValue.value.trim();
  if (!k) { message.value = t('Enter a key first', '请先输入键'); return; }
  const val = v || String(idCounter + 1);

  const existIdx = entries.value.findIndex(e => e.key === k);
  if (existIdx >= 0) {
    entries.value.splice(existIdx, 1);
    entries.value.unshift({ key: k, value: val, id: ++idCounter });
    animKey.value = k;
    animAction.value = 'hit';
    message.value = t(
      `put("${k}") → already exists — moved to MRU end. LRU assumes recent access predicts future access.`,
      `put("${k}") → 已存在 — 移至 MRU 端。LRU 假设最近访问的数据未来更可能再次被访问。`
    );
  } else {
    if (entries.value.length >= CAPACITY) {
      const evicted = entries.value.pop()!;
      animKey.value = evicted.key;
      animAction.value = 'evict';
      message.value = t(
        `put("${k}") → cache full! Evicted "${evicted.key}" (least recently used). This is O(1) with a hash map + doubly-linked list.`,
        `put("${k}") → 缓存已满！淘汰 "${evicted.key}"（最近最少使用）。通过哈希表 + 双向链表实现 O(1)。`
      );
    } else {
      message.value = t(
        `put("${k}", "${val}") → inserted at MRU position (front of list).`,
        `put("${k}", "${val}") → 插入到 MRU 位置（链表头部）。`
      );
    }
    entries.value.unshift({ key: k, value: val, id: ++idCounter });
    safeTimeout(() => { animKey.value = k; animAction.value = 'insert'; }, 50);
  }
  inputKey.value = '';
  inputValue.value = '';
  safeTimeout(() => { animKey.value = ''; animAction.value = ''; }, 500);
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
    message.value = t(
      `get("${k}") → HIT! Moved to front — recently used items stay in cache longer.`,
      `get("${k}") → 命中！移至头部 — 最近使用的项在缓存中保留更久。`
    );
  } else {
    animKey.value = k;
    animAction.value = 'miss';
    message.value = t(
      `get("${k}") → MISS! Not in cache. In production, this triggers a slower fetch from the backing store.`,
      `get("${k}") → 未命中！不在缓存中。在生产中，这会触发一次较慢的后端存储查询。`
    );
  }
  inputKey.value = '';
  safeTimeout(() => { animKey.value = ''; animAction.value = ''; }, 500);
}

function reset() {
  clearAll();
  entries.value = [];
  message.value = t('Cache cleared!', '缓存已清空！');
  animKey.value = '';
  animAction.value = '';
  presetRunning = false;
}

async function runPreset(steps: Array<{ op: 'put' | 'get'; key: string; val?: string }>) {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  for (const step of steps) {
    if (!presetRunning) return;
    await new Promise(r => safeTimeout(r, 800));
    if (!presetRunning) return;
    if (step.op === 'put') put(step.key, step.val ?? step.key.toLowerCase());
    else get(step.key);
  }
  presetRunning = false;
}

function presetWebCache() {
  runPreset([
    { op: 'put', key: 'A', val: 'page1' },
    { op: 'put', key: 'B', val: 'page2' },
    { op: 'put', key: 'C', val: 'page3' },
    { op: 'put', key: 'D', val: 'page4' },
    { op: 'get', key: 'A' },
    { op: 'get', key: 'B' },
    { op: 'put', key: 'E', val: 'page5' },
    { op: 'get', key: 'C' },
  ]);
}

function presetThrashing() {
  runPreset([
    { op: 'put', key: 'A', val: '1' },
    { op: 'put', key: 'B', val: '2' },
    { op: 'put', key: 'C', val: '3' },
    { op: 'put', key: 'D', val: '4' },
    { op: 'put', key: 'E', val: '5' },
    { op: 'get', key: 'A' },
    { op: 'put', key: 'F', val: '6' },
    { op: 'get', key: 'B' },
  ]);
}

function presetZipf() {
  runPreset([
    { op: 'put', key: 'A', val: 'hot' },
    { op: 'put', key: 'B', val: 'warm' },
    { op: 'put', key: 'C', val: 'cool' },
    { op: 'put', key: 'D', val: 'cold' },
    { op: 'get', key: 'A' },
    { op: 'get', key: 'A' },
    { op: 'get', key: 'B' },
    { op: 'get', key: 'A' },
    { op: 'put', key: 'E', val: 'new' },
    { op: 'get', key: 'A' },
  ]);
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
        <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
        <div class="viz-speed">
          <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
          <span class="viz-speed-val">{{ speed }}x</span>
        </div>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetWebCache">{{ t('Web Cache', 'Web 缓存') }}</button>
      <button class="viz-btn" @click="presetThrashing">{{ t('Thrashing', '缓存抖动') }}</button>
      <button class="viz-btn" @click="presetZipf">{{ t('Zipf (Hot Keys)', 'Zipf（热键）') }}</button>
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
  animation: viz-pulse 0.5s ease;
  border-color: var(--viz-success);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
}

.lru-node--insert {
  animation: viz-slide-in 0.4s ease;
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
</style>
