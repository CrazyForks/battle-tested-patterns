<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

interface KV {
  key: string;
  value: string;
}

interface SSTable {
  id: number;
  entries: KV[];
}

const MEMTABLE_CAPACITY = 4;

let nextSstId = 1;

const memtable = ref<KV[]>([]);
const level0 = ref<SSTable[]>([]);
const level1 = ref<SSTable[]>([]);

const writeKey = ref('');
const writeValue = ref('');
const readKey = ref('');
const searchPath = ref<string[]>([]);
const searchResult = ref<{ found: boolean; value: string; level: string } | null>(null);
const highlightLevel = ref<string | null>(null);
const highlightKey = ref<string | null>(null);
const flushing = ref(false);
const compacting = ref(false);
const message = ref(t('Write key-value pairs. Memtable auto-flushes at 4 entries.', '写入键值对。Memtable 在 4 条时自动刷盘。'));

const memtableSorted = computed(() => {
  return [...memtable.value].sort((a, b) => a.key.localeCompare(b.key));
});

function insertSorted(arr: KV[], kv: KV): KV[] {
  const filtered = arr.filter(e => e.key !== kv.key);
  filtered.push(kv);
  return filtered.sort((a, b) => a.key.localeCompare(b.key));
}

let aborted = false;
onUnmounted(() => { aborted = true; });

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function write() {
  const k = writeKey.value.trim();
  const v = writeValue.value.trim();
  if (!k || !v) {
    message.value = t('Enter both key and value', '请输入键和值');
    return;
  }

  // Clear search state
  searchPath.value = [];
  searchResult.value = null;
  highlightLevel.value = null;
  highlightKey.value = null;

  // Insert into memtable (sorted, overwrite if exists)
  memtable.value = insertSorted(memtable.value, { key: k, value: v });
  writeKey.value = '';
  writeValue.value = '';
  message.value = t(`Wrote "${k}=${v}" to memtable (${memtable.value.length}/${MEMTABLE_CAPACITY})`, `已写入 "${k}=${v}" 到 Memtable（${memtable.value.length}/${MEMTABLE_CAPACITY}）`);

  // Auto-flush when memtable is full
  if (memtable.value.length >= MEMTABLE_CAPACITY) {
    await delay(400);
    if (aborted) return;
    await flush();
  }
}

async function flush() {
  if (memtable.value.length === 0 || flushing.value) return;
  flushing.value = true;
  message.value = t('Flushing memtable to Level 0 SSTable...', '正在将 Memtable 刷盘到 Level 0 SSTable...');
  await delay(500);
  if (aborted) return;

  const sst: SSTable = {
    id: nextSstId++,
    entries: [...memtableSorted.value],
  };
  level0.value = [...level0.value, sst];
  memtable.value = [];
  flushing.value = false;
  message.value = t(`Flushed! Created SSTable #${sst.id} in Level 0 with ${sst.entries.length} entries`, `已刷盘！在 Level 0 创建 SSTable #${sst.id}，含 ${sst.entries.length} 条记录`);
}

async function compact() {
  if (level0.value.length === 0 || compacting.value) return;
  compacting.value = true;
  message.value = t('Compacting: merging Level 0 SSTables into Level 1...', '压缩中：将 Level 0 SSTable 合并到 Level 1...');
  await delay(600);
  if (aborted) return;

  // Merge all L0 SSTables with existing L1 SSTables
  const allEntries: Map<string, string> = new Map();

  // L1 entries first (older)
  for (const sst of level1.value) {
    for (const entry of sst.entries) {
      allEntries.set(entry.key, entry.value);
    }
  }

  // L0 entries override (newer)
  for (const sst of level0.value) {
    for (const entry of sst.entries) {
      allEntries.set(entry.key, entry.value);
    }
  }

  // Create single sorted L1 SSTable
  const merged: KV[] = Array.from(allEntries.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const sst: SSTable = {
    id: nextSstId++,
    entries: merged,
  };

  const l0Count = level0.value.length;
  level1.value = [sst];
  level0.value = [];
  compacting.value = false;
  message.value = t(`Compaction done! Merged ${l0Count} L0 SSTable(s) into Level 1 SSTable #${sst.id} (${merged.length} entries)`, `压缩完成！将 ${l0Count} 个 L0 SSTable 合并为 Level 1 SSTable #${sst.id}（${merged.length} 条记录）`);
}

async function read() {
  const k = readKey.value.trim();
  if (!k) {
    message.value = t('Enter a key to search', '请输入要搜索的键');
    return;
  }

  searchPath.value = [];
  searchResult.value = null;
  highlightKey.value = k;

  // Search memtable first
  highlightLevel.value = 'memtable';
  searchPath.value = ['memtable'];
  message.value = t(`Searching memtable for "${k}"...`, `正在 Memtable 中搜索 "${k}"...`);
  await delay(400);
  if (aborted) return;

  const memEntry = memtable.value.find(e => e.key === k);
  if (memEntry) {
    searchResult.value = { found: true, value: memEntry.value, level: 'Memtable' };
    message.value = t(`Found "${k}=${memEntry.value}" in Memtable (fastest path!)`, `在 Memtable 中找到 "${k}=${memEntry.value}"（最快路径！）`);
    return;
  }

  // Search L0 (newest to oldest)
  for (let i = level0.value.length - 1; i >= 0; i--) {
    const sst = level0.value[i];
    highlightLevel.value = `l0-${sst.id}`;
    searchPath.value = [...searchPath.value, `l0-${sst.id}`];
    message.value = t(`Searching L0 SSTable #${sst.id} for "${k}"...`, `正在 L0 SSTable #${sst.id} 中搜索 "${k}"...`);
    await delay(400);
    if (aborted) return;

    const entry = sst.entries.find(e => e.key === k);
    if (entry) {
      searchResult.value = { found: true, value: entry.value, level: `L0 SSTable #${sst.id}` };
      message.value = t(`Found "${k}=${entry.value}" in L0 SSTable #${sst.id}`, `在 L0 SSTable #${sst.id} 中找到 "${k}=${entry.value}"`);
      return;
    }
  }

  // Search L1
  for (const sst of level1.value) {
    highlightLevel.value = `l1-${sst.id}`;
    searchPath.value = [...searchPath.value, `l1-${sst.id}`];
    message.value = t(`Searching L1 SSTable #${sst.id} for "${k}"...`, `正在 L1 SSTable #${sst.id} 中搜索 "${k}"...`);
    await delay(400);
    if (aborted) return;

    const entry = sst.entries.find(e => e.key === k);
    if (entry) {
      searchResult.value = { found: true, value: entry.value, level: `L1 SSTable #${sst.id}` };
      message.value = t(`Found "${k}=${entry.value}" in L1 SSTable #${sst.id}`, `在 L1 SSTable #${sst.id} 中找到 "${k}=${entry.value}"`);
      return;
    }
  }

  searchResult.value = { found: false, value: '', level: '' };
  highlightLevel.value = null;
  message.value = t(`Key "${k}" not found. Searched ${searchPath.value.length} level(s).`, `未找到键 "${k}"。已搜索 ${searchPath.value.length} 个层级。`);
}

function reset() {
  memtable.value = [];
  level0.value = [];
  level1.value = [];
  writeKey.value = '';
  writeValue.value = '';
  readKey.value = '';
  searchPath.value = [];
  searchResult.value = null;
  highlightLevel.value = null;
  highlightKey.value = null;
  flushing.value = false;
  compacting.value = false;
  nextSstId = 1;
  message.value = t('Reset. Write key-value pairs to begin.', '已重置。写入键值对以开始。');
}

function isLevelHighlighted(levelId: string): boolean {
  return highlightLevel.value === levelId;
}

function isInSearchPath(levelId: string): boolean {
  return searchPath.value.includes(levelId);
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive LSM-Tree', '交互式 LSM Tree') }}</div>

    <!-- Layers -->
    <div class="lsm-layers">
      <!-- Memtable -->
      <div
        class="lsm-layer"
        :class="{
          'lsm-layer--highlight': isLevelHighlighted('memtable'),
          'lsm-layer--searched': isInSearchPath('memtable') && !isLevelHighlighted('memtable'),
          'lsm-layer--flushing': flushing,
        }"
      >
        <div class="lsm-layer-header">
          <span class="lsm-layer-name">Memtable</span>
          <span class="lsm-layer-tag lsm-tag--mem">IN-MEMORY</span>
          <span class="lsm-layer-count">{{ memtable.length }}/{{ MEMTABLE_CAPACITY }}</span>
        </div>
        <div class="lsm-entries">
          <div
            v-for="entry in memtableSorted"
            :key="'mem-' + entry.key"
            class="lsm-entry"
            :class="{ 'lsm-entry--found': highlightKey === entry.key && isLevelHighlighted('memtable') }"
          >
            <span class="lsm-key">{{ entry.key }}</span>
            <span class="lsm-sep">=</span>
            <span class="lsm-val">{{ entry.value }}</span>
          </div>
          <div v-if="memtable.length === 0" class="lsm-empty">{{ t('empty', '空') }}</div>
        </div>
        <!-- Capacity bar -->
        <div class="lsm-capacity-track">
          <div
            class="lsm-capacity-fill"
            :style="{ width: (memtable.length / MEMTABLE_CAPACITY * 100) + '%' }"
            :class="{ 'lsm-capacity-fill--full': memtable.length >= MEMTABLE_CAPACITY }"
          ></div>
        </div>
      </div>

      <!-- Flush arrow -->
      <div class="lsm-arrow" :class="{ 'lsm-arrow--active': flushing }">
        <svg width="24" height="28" viewBox="0 0 24 28">
          <path d="M12 2 L12 20 M7 16 L12 22 L17 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="lsm-arrow-label">{{ t('flush', '刷盘') }}</span>
      </div>

      <!-- Level 0 -->
      <div class="lsm-level">
        <div class="lsm-level-header">
          <span class="lsm-level-name">Level 0</span>
          <span class="lsm-layer-tag lsm-tag--disk">ON-DISK</span>
          <span class="lsm-level-info">{{ level0.length }} SSTable(s)</span>
        </div>
        <div class="lsm-sstables">
          <div
            v-for="sst in level0"
            :key="'l0-' + sst.id"
            class="lsm-layer lsm-layer--sst"
            :class="{
              'lsm-layer--highlight': isLevelHighlighted(`l0-${sst.id}`),
              'lsm-layer--searched': isInSearchPath(`l0-${sst.id}`) && !isLevelHighlighted(`l0-${sst.id}`),
            }"
          >
            <div class="lsm-sst-header">SSTable #{{ sst.id }}</div>
            <div class="lsm-entries lsm-entries--compact">
              <div
                v-for="entry in sst.entries"
                :key="'l0e-' + sst.id + '-' + entry.key"
                class="lsm-entry lsm-entry--small"
                :class="{ 'lsm-entry--found': highlightKey === entry.key && isLevelHighlighted(`l0-${sst.id}`) }"
              >
                <span class="lsm-key">{{ entry.key }}</span>
                <span class="lsm-sep">=</span>
                <span class="lsm-val">{{ entry.value }}</span>
              </div>
            </div>
          </div>
          <div v-if="level0.length === 0" class="lsm-empty-level">{{ t('no SSTables', '无 SSTable') }}</div>
        </div>
      </div>

      <!-- Compact arrow -->
      <div class="lsm-arrow" :class="{ 'lsm-arrow--active': compacting }">
        <svg width="24" height="28" viewBox="0 0 24 28">
          <path d="M12 2 L12 20 M7 16 L12 22 L17 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="lsm-arrow-label">{{ t('compact', '压缩') }}</span>
      </div>

      <!-- Level 1 -->
      <div class="lsm-level">
        <div class="lsm-level-header">
          <span class="lsm-level-name">Level 1</span>
          <span class="lsm-layer-tag lsm-tag--disk">ON-DISK</span>
          <span class="lsm-level-info">{{ level1.length }} SSTable(s)</span>
        </div>
        <div class="lsm-sstables">
          <div
            v-for="sst in level1"
            :key="'l1-' + sst.id"
            class="lsm-layer lsm-layer--sst"
            :class="{
              'lsm-layer--highlight': isLevelHighlighted(`l1-${sst.id}`),
              'lsm-layer--searched': isInSearchPath(`l1-${sst.id}`) && !isLevelHighlighted(`l1-${sst.id}`),
            }"
          >
            <div class="lsm-sst-header">SSTable #{{ sst.id }}</div>
            <div class="lsm-entries lsm-entries--compact">
              <div
                v-for="entry in sst.entries"
                :key="'l1e-' + sst.id + '-' + entry.key"
                class="lsm-entry lsm-entry--small"
                :class="{ 'lsm-entry--found': highlightKey === entry.key && isLevelHighlighted(`l1-${sst.id}`) }"
              >
                <span class="lsm-key">{{ entry.key }}</span>
                <span class="lsm-sep">=</span>
                <span class="lsm-val">{{ entry.value }}</span>
              </div>
            </div>
          </div>
          <div v-if="level1.length === 0" class="lsm-empty-level">{{ t('no SSTables', '无 SSTable') }}</div>
        </div>
      </div>
    </div>

    <!-- Search result -->
    <div v-if="searchResult" class="lsm-search-result" :class="searchResult.found ? 'lsm-search-result--found' : 'lsm-search-result--miss'">
      <span v-if="searchResult.found">Found: <strong>{{ highlightKey }}={{ searchResult.value }}</strong> in {{ searchResult.level }}</span>
      <span v-else>Key "<strong>{{ highlightKey }}</strong>" not found</span>
      <span class="lsm-search-path">{{ t(`Search path: ${searchPath.length} level(s) checked`, `搜索路径：已检查 ${searchPath.length} 个层级`) }}</span>
    </div>

    <!-- Controls -->
    <div class="lsm-controls-grid">
      <!-- Write controls -->
      <div class="lsm-control-group">
        <span class="lsm-control-label">{{ t('Write', '写入') }}</span>
        <div class="lsm-input-row">
          <input
            v-model="writeKey"
            class="lsm-input"
            :placeholder="t('key', '键')"
            maxlength="6"
            @keydown.enter="write"
          />
          <input
            v-model="writeValue"
            class="lsm-input"
            :placeholder="t('value', '值')"
            maxlength="6"
            @keydown.enter="write"
          />
          <button class="viz-btn viz-btn--primary" @click="write" :disabled="flushing || compacting">{{ t('Write', '写入') }}</button>
        </div>
      </div>

      <!-- Read controls -->
      <div class="lsm-control-group">
        <span class="lsm-control-label">{{ t('Read', '读取') }}</span>
        <div class="lsm-input-row">
          <input
            v-model="readKey"
            class="lsm-input"
            :placeholder="t('search key', '搜索键')"
            maxlength="6"
            @keydown.enter="read"
          />
          <button class="viz-btn" @click="read">{{ t('Read', '读取') }}</button>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn" @click="compact" :disabled="level0.length === 0 || compacting || flushing">{{ t('Compact L0 -> L1', '压缩 L0 -> L1') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.lsm-layers {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 0.5rem 0;
}

.lsm-layer {
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 2px solid var(--viz-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  transition: all 0.3s ease;
}

.lsm-layer--sst {
  border-width: 1px;
  border-radius: 6px;
  padding: 0.375rem 0.5rem;
}

.lsm-layer--highlight {
  border-color: var(--viz-primary);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
}

.lsm-layer--searched {
  border-color: var(--viz-muted);
  opacity: 0.7;
}

.lsm-layer--flushing {
  border-color: var(--viz-warning);
  animation: lsm-flush-pulse 0.5s ease infinite;
}

.lsm-layer-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.lsm-layer-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--viz-text);
}

.lsm-layer-tag {
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.04em;
}

.lsm-tag--mem {
  background: rgba(245, 158, 11, 0.12);
  color: var(--viz-warning);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.lsm-tag--disk {
  background: rgba(59, 130, 246, 0.08);
  color: var(--viz-primary);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.lsm-layer-count {
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  margin-left: auto;
}

.lsm-entries {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 28px;
  align-items: center;
}

.lsm-entries--compact {
  gap: 3px;
  min-height: 22px;
}

.lsm-entry {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid var(--viz-border);
  transition: all 0.2s ease;
  animation: lsm-entry-appear 0.25s ease;
}

.lsm-entry--small {
  padding: 2px 4px;
  font-size: 0.6875rem;
}

.lsm-entry--found {
  border-color: var(--viz-success);
  background: rgba(16, 185, 129, 0.15);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
  animation: lsm-found-pulse 0.4s ease;
}

.lsm-key {
  font-weight: 700;
  color: var(--viz-primary);
}

.lsm-sep {
  color: var(--viz-muted);
}

.lsm-val {
  color: var(--viz-text);
}

.lsm-empty {
  font-size: 0.75rem;
  color: var(--viz-muted);
  font-style: italic;
}

.lsm-capacity-track {
  height: 4px;
  border-radius: 2px;
  background: var(--viz-cell-empty);
  margin-top: 0.375rem;
  overflow: hidden;
}

.lsm-capacity-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--viz-success);
  transition: width 0.3s ease;
}

.lsm-capacity-fill--full {
  background: var(--viz-danger);
}

/* Arrows */
.lsm-arrow {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--viz-muted);
  padding: 0.125rem 0;
  transition: color 0.2s ease;
}

.lsm-arrow--active {
  color: var(--viz-warning);
}

.lsm-arrow-label {
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Levels */
.lsm-level {
  width: 100%;
}

.lsm-level-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.lsm-level-name {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
}

.lsm-level-info {
  font-size: 0.625rem;
  color: var(--viz-muted);
  margin-left: auto;
}

.lsm-sstables {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lsm-sst-header {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--viz-muted);
  margin-bottom: 2px;
}

.lsm-empty-level {
  font-size: 0.6875rem;
  color: var(--viz-muted);
  font-style: italic;
  padding: 0.5rem;
  text-align: center;
  border: 1px dashed var(--viz-border);
  border-radius: 6px;
}

/* Search result */
.lsm-search-result {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  margin: 0.5rem 0;
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  animation: lsm-entry-appear 0.3s ease;
}

.lsm-search-result--found {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid var(--viz-success);
  color: var(--viz-text);
}

.lsm-search-result--miss {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid var(--viz-danger);
  color: var(--viz-text);
}

.lsm-search-path {
  font-size: 0.625rem;
  color: var(--viz-muted);
}

/* Controls */
.lsm-controls-grid {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.lsm-control-group {
  flex: 1;
  min-width: 180px;
}

.lsm-control-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-bottom: 0.25rem;
  display: block;
}

.lsm-input-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.lsm-input {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 4px;
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  width: 70px;
  transition: border-color 0.15s ease;
}

.lsm-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

.lsm-input::placeholder {
  color: var(--viz-muted);
  opacity: 0.6;
}

.viz-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes lsm-entry-appear {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes lsm-flush-pulse {
  0%, 100% { border-color: var(--viz-warning); }
  50% { border-color: var(--viz-danger); }
}

@keyframes lsm-found-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

@media (max-width: 640px) {
  .lsm-controls-grid {
    flex-direction: column;
    gap: 0.5rem;
  }
  .lsm-control-group {
    min-width: unset;
  }
  .lsm-input {
    width: 60px;
  }
  .lsm-entry {
    font-size: 0.6875rem;
    padding: 2px 4px;
  }
}
</style>
