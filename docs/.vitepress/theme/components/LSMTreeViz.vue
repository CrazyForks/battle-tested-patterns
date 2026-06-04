<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

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
const message = ref(t(
  'Write key-value pairs. Memtable auto-flushes at 4 entries. This is how RocksDB, LevelDB, Cassandra, and HBase store data.',
  '写入键值对。Memtable 在 4 条时自动刷盘。RocksDB、LevelDB、Cassandra 和 HBase 就是这样存储数据的。'
));
let presetRunning = false;

const memtableSorted = computed(() => {
  return [...memtable.value].sort((a, b) => a.key.localeCompare(b.key));
});

function insertSorted(arr: KV[], kv: KV): KV[] {
  const filtered = arr.filter(e => e.key !== kv.key);
  filtered.push(kv);
  return filtered.sort((a, b) => a.key.localeCompare(b.key));
}

async function write() {
  const k = writeKey.value.trim();
  const v = writeValue.value.trim();
  if (!k || !v) {
    message.value = t('Enter both key and value', '请输入键和值');
    return;
  }

  searchPath.value = [];
  searchResult.value = null;
  highlightLevel.value = null;
  highlightKey.value = null;

  memtable.value = insertSorted(memtable.value, { key: k, value: v });
  writeKey.value = '';
  writeValue.value = '';
  message.value = t(
    `Wrote "${k}=${v}" to memtable (${memtable.value.length}/${MEMTABLE_CAPACITY}). Writes are always O(log n) to the in-memory sorted structure.`,
    `已写入 "${k}=${v}" 到 Memtable（${memtable.value.length}/${MEMTABLE_CAPACITY}）。写入总是 O(log n) 到内存排序结构。`
  );

  if (memtable.value.length >= MEMTABLE_CAPACITY) {
    await delay(400);
    if (isAborted()) return;
    await flush();
  }
}

async function flush() {
  if (memtable.value.length === 0 || flushing.value) return;
  flushing.value = true;
  message.value = t('Flushing memtable to Level 0 SSTable...', '正在将 Memtable 刷盘到 Level 0 SSTable...');
  await delay(500);
  if (isAborted()) { flushing.value = false; return; }

  const sst: SSTable = {
    id: nextSstId++,
    entries: [...memtableSorted.value],
  };
  level0.value = [...level0.value, sst];
  memtable.value = [];
  flushing.value = false;
  message.value = t(
    `Flushed! Created SSTable #${sst.id} in Level 0 with ${sst.entries.length} entries. SSTables are immutable — once written, never modified.`,
    `已刷盘！在 Level 0 创建 SSTable #${sst.id}，含 ${sst.entries.length} 条记录。SSTable 是不可变的 — 一旦写入，永不修改。`
  );
}

async function compact() {
  if (level0.value.length === 0 || compacting.value) return;
  compacting.value = true;
  message.value = t(
    'Compacting: merging Level 0 SSTables into Level 1. This is the background merge that gives LSM trees their name — Log-Structured Merge.',
    '压缩中：将 Level 0 SSTable 合并到 Level 1。这就是给 LSM 树命名的后台合并 — Log-Structured Merge。'
  );
  await delay(600);
  if (isAborted()) { compacting.value = false; return; }

  const allEntries: Map<string, string> = new Map();

  for (const sst of level1.value) {
    for (const entry of sst.entries) {
      allEntries.set(entry.key, entry.value);
    }
  }

  for (const sst of level0.value) {
    for (const entry of sst.entries) {
      allEntries.set(entry.key, entry.value);
    }
  }

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
  message.value = t(
    `Compaction done! Merged ${l0Count} L0 SSTable(s) into Level 1 SSTable #${sst.id} (${merged.length} entries). Newer values override older ones — this is how updates and deletes work.`,
    `压缩完成！将 ${l0Count} 个 L0 SSTable 合并为 Level 1 SSTable #${sst.id}（${merged.length} 条记录）。新值覆盖旧值 — 更新和删除就是这样工作的。`
  );
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

  highlightLevel.value = 'memtable';
  searchPath.value = ['memtable'];
  message.value = t(`Searching memtable for "${k}"...`, `正在 Memtable 中搜索 "${k}"...`);
  await delay(400);
  if (isAborted()) return;

  const memEntry = memtable.value.find(e => e.key === k);
  if (memEntry) {
    searchResult.value = { found: true, value: memEntry.value, level: 'Memtable' };
    message.value = t(
      `Found "${k}=${memEntry.value}" in Memtable (fastest path!). Reads check memtable first — this is why recent writes are fast.`,
      `在 Memtable 中找到 "${k}=${memEntry.value}"（最快路径！）。读取首先检查 memtable — 这就是最近写入快速的原因。`
    );
    return;
  }

  for (let i = level0.value.length - 1; i >= 0; i--) {
    const sst = level0.value[i];
    highlightLevel.value = `l0-${sst.id}`;
    searchPath.value = [...searchPath.value, `l0-${sst.id}`];
    message.value = t(`Searching L0 SSTable #${sst.id} for "${k}"...`, `正在 L0 SSTable #${sst.id} 中搜索 "${k}"...`);
    await delay(400);
    if (isAborted()) return;

    const entry = sst.entries.find(e => e.key === k);
    if (entry) {
      searchResult.value = { found: true, value: entry.value, level: `L0 SSTable #${sst.id}` };
      message.value = t(`Found "${k}=${entry.value}" in L0 SSTable #${sst.id}`, `在 L0 SSTable #${sst.id} 中找到 "${k}=${entry.value}"`);
      return;
    }
  }

  for (const sst of level1.value) {
    highlightLevel.value = `l1-${sst.id}`;
    searchPath.value = [...searchPath.value, `l1-${sst.id}`];
    message.value = t(`Searching L1 SSTable #${sst.id} for "${k}"...`, `正在 L1 SSTable #${sst.id} 中搜索 "${k}"...`);
    await delay(400);
    if (isAborted()) return;

    const entry = sst.entries.find(e => e.key === k);
    if (entry) {
      searchResult.value = { found: true, value: entry.value, level: `L1 SSTable #${sst.id}` };
      message.value = t(`Found "${k}=${entry.value}" in L1 SSTable #${sst.id}`, `在 L1 SSTable #${sst.id} 中找到 "${k}=${entry.value}"`);
      return;
    }
  }

  searchResult.value = { found: false, value: '', level: '' };
  highlightLevel.value = null;
  message.value = t(
    `Key "${k}" not found. Searched ${searchPath.value.length} level(s). Bloom filters (used by RocksDB) skip SSTables that definitely don't contain the key.`,
    `未找到键 "${k}"。已搜索 ${searchPath.value.length} 个层级。布隆过滤器（RocksDB 使用）跳过肯定不包含该键的 SSTable。`
  );
}

function reset() {
  clearAll();
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
  presetRunning = false;
  message.value = t('Reset. Write key-value pairs to begin.', '已重置。写入键值对以开始。');
}

function isLevelHighlighted(levelId: string): boolean {
  return highlightLevel.value === levelId;
}

function isInSearchPath(levelId: string): boolean {
  return searchPath.value.includes(levelId);
}

async function presetWriteHeavy() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Write-heavy workload: 8 writes trigger 2 flushes. LSM trees optimize for writes — all writes go to memtable (in-memory), then batch-flush to disk. This is why Cassandra handles 100K+ writes/sec.',
    '写密集型负载：8 次写入触发 2 次刷盘。LSM 树为写入优化 — 所有写入先到 memtable（内存），然后批量刷盘。这就是 Cassandra 处理 10 万+ 次/秒写入的原因。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  const data = [['a','1'],['b','2'],['c','3'],['d','4'],['e','5'],['f','6'],['g','7'],['h','8']];
  for (const [k, v] of data) {
    if (!presetRunning || isAborted()) return;
    writeKey.value = k;
    writeValue.value = v;
    await write();
    await delay(400);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    '8 writes done, 2 SSTables in L0. Without compaction, reads get slower (must check each SSTable). Compaction merges them — the classic write amplification tradeoff.',
    '8 次写入完成，L0 中有 2 个 SSTable。不压缩的话，读取变慢（必须检查每个 SSTable）。压缩合并它们 — 经典的写放大权衡。'
  );
  presetRunning = false;
}

async function presetCompactionDemo() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Compaction demo: write 8 entries (2 L0 SSTables), then compact to L1. Compaction merges sorted runs — this is the "merge" in Log-Structured Merge tree.',
    '压缩演示：写入 8 条记录（2 个 L0 SSTable），然后压缩到 L1。压缩合并排序的运行 — 这就是 Log-Structured Merge 树中的"merge"。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  const data = [['a','1'],['c','3'],['e','5'],['g','7'],['b','2'],['d','4'],['f','6'],['h','8']];
  for (const [k, v] of data) {
    if (!presetRunning || isAborted()) return;
    writeKey.value = k;
    writeValue.value = v;
    await write();
    await delay(300);
  }
  if (!presetRunning || isAborted()) return;
  await delay(500);
  await compact();
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Compaction merged 2 L0 SSTables into 1 sorted L1 SSTable. Keys a-h now in one place — reads only check 1 SSTable instead of 2. RocksDB does this in background threads.',
    '压缩将 2 个 L0 SSTable 合并为 1 个排序的 L1 SSTable。键 a-h 现在在一个位置 — 读取只需检查 1 个 SSTable 而非 2 个。RocksDB 在后台线程中执行此操作。'
  );
  presetRunning = false;
}

async function presetUpdateOverwrite() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Update semantics: write key "x" twice with different values. The newer value wins during compaction — LSM trees never update in place, they append and merge later.',
    '更新语义：用不同的值写入键 "x" 两次。压缩时新值胜出 — LSM 树从不就地更新，而是追加后合并。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  writeKey.value = 'x'; writeValue.value = 'old';
  await write(); await delay(400);
  if (!presetRunning || isAborted()) return;
  writeKey.value = 'y'; writeValue.value = '1';
  await write(); await delay(400);
  if (!presetRunning || isAborted()) return;
  writeKey.value = 'z'; writeValue.value = '1';
  await write(); await delay(400);
  if (!presetRunning || isAborted()) return;
  writeKey.value = 'w'; writeValue.value = '1';
  await write(); await delay(600);
  if (!presetRunning || isAborted()) return;
  writeKey.value = 'x'; writeValue.value = 'NEW';
  await write(); await delay(600);
  if (!presetRunning || isAborted()) return;
  readKey.value = 'x';
  await read();
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Reading "x" returns "NEW" from memtable (most recent write). The "old" value in L0 SSTable is shadowed. Compaction will eventually discard the old value.',
    '读取 "x" 从 memtable 返回 "NEW"（最近的写入）。L0 SSTable 中的 "old" 值被遮蔽。压缩最终会丢弃旧值。'
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive LSM-Tree', '交互式 LSM Tree') }}</div>

    <!-- Layers -->
    <div class="lsm-layers">
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
        <div class="lsm-capacity-track">
          <div
            class="lsm-capacity-fill"
            :style="{ width: (memtable.length / MEMTABLE_CAPACITY * 100) + '%' }"
            :class="{ 'lsm-capacity-fill--full': memtable.length >= MEMTABLE_CAPACITY }"
          ></div>
        </div>
      </div>

      <div class="lsm-arrow" :class="{ 'lsm-arrow--active': flushing }">
        <svg width="24" height="28" viewBox="0 0 24 28">
          <path d="M12 2 L12 20 M7 16 L12 22 L17 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="lsm-arrow-label">{{ t('flush', '刷盘') }}</span>
      </div>

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

      <div class="lsm-arrow" :class="{ 'lsm-arrow--active': compacting }">
        <svg width="24" height="28" viewBox="0 0 24 28">
          <path d="M12 2 L12 20 M7 16 L12 22 L17 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="lsm-arrow-label">{{ t('compact', '压缩') }}</span>
      </div>

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
      <div class="lsm-control-group">
        <span class="lsm-control-label">{{ t('Write', '写入') }}</span>
        <div class="lsm-input-row">
          <input v-model="writeKey" class="lsm-input" :placeholder="t('key', '键')" maxlength="6" @keydown.enter="write" />
          <input v-model="writeValue" class="lsm-input" :placeholder="t('value', '值')" maxlength="6" @keydown.enter="write" />
          <button class="viz-btn viz-btn--primary" @click="write" :disabled="flushing || compacting">{{ t('Write', '写入') }}</button>
        </div>
      </div>
      <div class="lsm-control-group">
        <span class="lsm-control-label">{{ t('Read', '读取') }}</span>
        <div class="lsm-input-row">
          <input v-model="readKey" class="lsm-input" :placeholder="t('search key', '搜索键')" maxlength="6" @keydown.enter="read" />
          <button class="viz-btn" @click="read">{{ t('Read', '读取') }}</button>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn" @click="compact" :disabled="level0.length === 0 || compacting || flushing">{{ t('Compact L0 -> L1', '压缩 L0 -> L1') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetWriteHeavy">{{ t('Write Heavy', '写密集') }}</button>
      <button class="viz-btn" @click="presetCompactionDemo">{{ t('Compaction', '压缩') }}</button>
      <button class="viz-btn" @click="presetUpdateOverwrite">{{ t('Update Key', '更新键') }}</button>
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
  animation: viz-slide-in 0.25s ease;
}

.lsm-entry--small {
  padding: 2px 4px;
  font-size: 0.6875rem;
}

.lsm-entry--found {
  border-color: var(--viz-success);
  background: rgba(16, 185, 129, 0.15);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
  animation: viz-pulse 0.4s ease;
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

.lsm-search-result {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  margin: 0.5rem 0;
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  animation: viz-slide-in 0.3s ease;
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

@keyframes lsm-flush-pulse {
  0%, 100% { border-color: var(--viz-warning); }
  50% { border-color: var(--viz-danger); }
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
