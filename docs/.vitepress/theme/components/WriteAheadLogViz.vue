<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLogPanel from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log: vizLog, clear: clearLog } = useVizLog();

interface LogEntry {
  lsn: number;
  op: string;
  data: string;
  flushed: boolean;
}

interface TableRow {
  key: string;
  value: string;
}

let nextLSN = 1;

const log = ref<LogEntry[]>([]);
const table = ref<TableRow[]>([]);
const message = ref(
  t(
    'Write operations go to WAL first, then to the table — or pick a scenario to see crash recovery',
    '写入操作先进入 WAL，然后再写入表 — 或选择场景观看崩溃恢复',
  ),
);
const crashed = ref(false);
const lastAction = ref('');
let presetRunning = false;

interface WALSnapshot {
  log: LogEntry[];
  table: TableRow[];
  crashed: boolean;
}

const history = useVizHistory<WALSnapshot>(
  { log: log.value, table: table.value, crashed: crashed.value },
  {
    getMessage: () => message.value,
    onRestore(state, msg) {
      presetRunning = false;
      log.value = state.log;
      table.value = state.table;
      crashed.value = state.crashed;
      lastAction.value = '';
      if (msg !== undefined) message.value = msg;
    },
  },
);

function writeOp(key: string, value: string) {
  if (crashed.value) {
    message.value = t(
      'System crashed! Click "Recover" to replay the WAL',
      '系统已崩溃！点击"恢复"重放 WAL',
    );
    return;
  }
  const entry: LogEntry = {
    lsn: nextLSN++,
    op: 'SET',
    data: `${key}=${value}`,
    flushed: false,
  };
  log.value = [...log.value, entry];
  lastAction.value = `write-${entry.lsn}`;
  message.value = t(
    `WAL: logged SET ${key}=${value} (LSN ${entry.lsn}). Sequential write to disk — O(1) append, not random I/O. Data is durable even before flush.`,
    `WAL：已记录 SET ${key}=${value} (LSN ${entry.lsn})。顺序写入磁盘 — O(1) 追加，非随机 I/O。数据在刷写前就已持久化。`,
  );
  vizLog(
    t(`SET ${key}=${value} (LSN ${entry.lsn})`, `SET ${key}=${value} (LSN ${entry.lsn})`),
    'info',
  );
  history.commit(
    { log: log.value, table: table.value, crashed: crashed.value },
    `write ${key}=${value}`,
  );
}

function flush() {
  if (crashed.value) {
    message.value = t('System crashed! Recover first', '系统已崩溃！请先恢复');
    return;
  }
  const unflushed = log.value.filter((e) => !e.flushed);
  if (unflushed.length === 0) {
    message.value = t('Nothing to flush — WAL is clean', '无需刷写 — WAL 已是最新');
    return;
  }

  for (const entry of unflushed) {
    const [key, value] = entry.data.split('=');
    const existing = table.value.find((r) => r.key === key);
    if (existing) {
      existing.value = value;
    } else {
      table.value = [...table.value, { key, value }];
    }
    entry.flushed = true;
  }
  lastAction.value = 'flush';
  message.value = t(
    `Flushed ${unflushed.length} entries → table. This is the "checkpoint" — after this, the WAL entries can be garbage collected.`,
    `已刷写 ${unflushed.length} 条记录到表。这就是"检查点" — 之后，WAL 记录可以被垃圾回收。`,
  );
  vizLog(
    t(
      `flushed ${unflushed.length} entries (checkpoint)`,
      `刷写 ${unflushed.length} 条记录（检查点）`,
    ),
    'success',
  );
  history.commit({ log: log.value, table: table.value, crashed: crashed.value }, 'flush');
}

function simulateCrash() {
  const unflushed = log.value.filter((e) => !e.flushed);
  const flushedEntries = log.value.filter((e) => e.flushed);
  const restoredTable = new Map<string, string>();
  for (const entry of flushedEntries) {
    const [key, value] = entry.data.split('=');
    restoredTable.set(key, value);
  }
  table.value = Array.from(restoredTable.entries()).map(([key, value]) => ({ key, value }));
  crashed.value = true;
  lastAction.value = 'crash';
  message.value = t(
    `CRASH! ${unflushed.length} unflushed entries lost from table — but WAL on disk is intact. This is the key insight: WAL survives crashes because it's append-only on disk.`,
    `崩溃！${unflushed.length} 条未刷写记录从表中丢失 — 但磁盘上的 WAL 完好无损。核心洞察：WAL 因为是磁盘上的追加写入而能在崩溃中存活。`,
  );
  vizLog(
    t(
      `CRASH! ${unflushed.length} unflushed entries lost from table`,
      `崩溃！${unflushed.length} 条未刷写记录从表中丢失`,
    ),
    'error',
  );
  history.commit({ log: log.value, table: table.value, crashed: crashed.value }, 'crash');
}

function recover() {
  if (!crashed.value) return;
  const unflushed = log.value.filter((e) => !e.flushed);
  for (const entry of unflushed) {
    const [key, value] = entry.data.split('=');
    const existing = table.value.find((r) => r.key === key);
    if (existing) {
      existing.value = value;
    } else {
      table.value = [...table.value, { key, value }];
    }
    entry.flushed = true;
  }
  crashed.value = false;
  lastAction.value = 'recover';
  message.value = t(
    `Recovered! Replayed ${unflushed.length} WAL entries — data fully restored. PostgreSQL, SQLite, and etcd all use this exact recovery process.`,
    `已恢复！重放了 ${unflushed.length} 条 WAL 记录 — 数据完全还原。PostgreSQL、SQLite 和 etcd 都使用完全相同的恢复过程。`,
  );
  vizLog(
    t(
      `recovered: replayed ${unflushed.length} WAL entries`,
      `已恢复：重放 ${unflushed.length} 条 WAL 记录`,
    ),
    'success',
  );
  history.commit({ log: log.value, table: table.value, crashed: crashed.value }, 'recover');
}

function reset() {
  clearAll();
  nextLSN = 1;
  log.value = [];
  table.value = [];
  crashed.value = false;
  lastAction.value = '';
  presetRunning = false;
  clearLog();
  history.reset();
  message.value = t('Reset — start writing operations', '已重置 — 开始写入操作');
}

const presets = [
  { key: 'name', value: 'Alice' },
  { key: 'age', value: '30' },
  { key: 'city', value: 'NYC' },
  { key: 'name', value: 'Bob' },
];
let presetIdx = 0;

function autoWrite() {
  const p = presets[presetIdx % presets.length];
  presetIdx++;
  writeOp(p.key, p.value);
}

async function presetCrashRecovery() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  writeOp('name', 'Alice');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  writeOp('age', '30');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  flush();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  writeOp('city', 'NYC');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  writeOp('name', 'Bob');
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    '2 flushed + 2 unflushed entries. Now crashing — unflushed data disappears from table but stays in WAL...',
    '2 条已刷写 + 2 条未刷写记录。现在崩溃 — 未刷写数据从表中消失但保留在 WAL 中...',
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  simulateCrash();
  await delay(1500);
  if (!presetRunning || isAborted()) return;
  recover();
  vizLog(
    t(
      'WAL replay restores unflushed data after crash — sequential append + replay is the foundation of database durability.',
      'WAL 重放在崩溃后恢复未刷写数据 — 顺序追加 + 重放是数据库持久性的基础。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetUpdateInPlace() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  writeOp('counter', '1');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  flush();
  await delay(600);
  if (!presetRunning || isAborted()) return;
  writeOp('counter', '2');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  writeOp('counter', '3');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  flush();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'WAL preserves update history: counter went 1→2→3. Each LSN is immutable. This is why WAL enables point-in-time recovery in databases.',
    'WAL 保留更新历史：counter 从 1→2→3。每个 LSN 都是不可变的。这就是 WAL 在数据库中实现时间点恢复的原因。',
  );
  vizLog(
    t('Immutable LSNs enable point-in-time recovery', '不可变 LSN 实现时间点恢复'),
    'highlight',
  );
  presetRunning = false;
}

async function presetBatchFlush() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const ops = [
    { key: 'a', value: '1' },
    { key: 'b', value: '2' },
    { key: 'c', value: '3' },
    { key: 'd', value: '4' },
    { key: 'e', value: '5' },
  ];
  for (const op of ops) {
    if (!presetRunning || isAborted()) return;
    writeOp(op.key, op.value);
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    '5 writes buffered in WAL — all sequential appends. Now flushing in one batch. Batching amortizes disk I/O cost: 1 random write vs 5.',
    '5 次写入缓存在 WAL 中 — 全部顺序追加。现在批量刷写。批处理分摊了磁盘 I/O 成本：1 次随机写入 vs 5 次。',
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  flush();
  vizLog(
    t(
      'Batching WAL entries into one flush amortizes random I/O cost — 1 disk seek instead of N.',
      '将 WAL 条目批量刷写分摊随机 I/O 成本 — 1 次磁盘寻道而非 N 次。',
    ),
    'highlight',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Write-Ahead Log', '交互式 Write-Ahead Log') }}</div>

    <div class="wal-layout">
      <!-- WAL -->
      <div class="wal-section">
        <div class="wal-section-title">{{ t('WAL (on disk)', 'WAL（磁盘）') }}</div>
        <div class="wal-entries">
          <div
            v-for="entry in log"
            :key="entry.lsn"
            class="wal-entry"
            :class="{
              'wal-entry-flushed': entry.flushed,
              'wal-entry-new': lastAction === 'write-' + entry.lsn,
            }"
          >
            <span class="wal-lsn">{{ entry.lsn }}</span>
            <span class="wal-op">{{ entry.op }}</span>
            <span class="wal-data">{{ entry.data }}</span>
            <span class="wal-flush-badge" :class="entry.flushed ? 'wal-yes' : 'wal-no'">
              {{ entry.flushed ? '✓' : '○' }}
            </span>
          </div>
          <div v-if="log.length === 0" class="wal-empty">{{ t('empty', '空') }}</div>
        </div>
      </div>

      <!-- Arrow -->
      <div class="wal-arrow">
        <span v-if="!crashed">{{ t('flush →', '刷写 →') }}</span>
        <span v-else class="wal-crash-label">{{ t('CRASH ✗', '崩溃 ✗') }}</span>
      </div>

      <!-- Table -->
      <div class="wal-section">
        <div class="wal-section-title">{{ t('Table (in memory)', '表（内存）') }}</div>
        <div class="wal-table">
          <div v-for="row in table" :key="row.key" class="wal-row">
            <span class="wal-key">{{ row.key }}</span>
            <span class="wal-value">{{ row.value }}</span>
          </div>
          <div v-if="table.length === 0" class="wal-empty">{{ t('empty', '空') }}</div>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="autoWrite" :disabled="crashed">
        {{ t('Write', '写入') }}
      </button>
      <button class="viz-btn" @click="flush" :disabled="crashed">
        {{ t('Flush to Table', '刷写到表') }}
      </button>
      <button
        class="viz-btn viz-btn--danger"
        @click="simulateCrash"
        :disabled="crashed || log.length === 0"
      >
        {{ t('Crash!', '崩溃！') }}
      </button>
      <button v-if="crashed" class="viz-btn viz-btn--primary" @click="recover">
        {{ t('Recover', '恢复') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetCrashRecovery">
        {{ t('Crash & Recover', '崩溃恢复') }}
      </button>
      <button class="viz-btn" @click="presetUpdateInPlace">
        {{ t('Update History', '更新历史') }}
      </button>
      <button class="viz-btn" @click="presetBatchFlush">{{ t('Batch Flush', '批量刷写') }}</button>
    </div>

    <div class="viz-status" aria-live="polite" :class="{ 'wal-crash-status': crashed }">
      {{ message }}
    </div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLogPanel :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.wal-layout {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 0;
}

@media (width <= 640px) {
  .wal-layout {
    flex-direction: column;
    align-items: stretch;
  }
}

.wal-section {
  flex: 1;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  padding: 0.5rem;
  background: var(--vp-c-bg);
}

.wal-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-bottom: 6px;
}

.wal-entries {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 60px;
}

.wal-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  background: rgb(59 130 246 / 8%);
  border: 1px solid transparent;
}

.wal-entry-flushed {
  opacity: 0.5;
  background: rgb(16 185 129 / 8%);
}

.wal-entry-new {
  animation: wal-appear 0.3s ease;
  border-color: var(--viz-primary);
}

.wal-lsn {
  color: var(--viz-muted);
  min-width: 16px;
}

.wal-op {
  font-weight: 700;
  color: var(--viz-primary);
}

.wal-data {
  color: var(--viz-text);
  flex: 1;
}

.wal-flush-badge {
  font-size: 0.75rem;
}

.wal-yes {
  color: var(--viz-success);
}

.wal-no {
  color: var(--viz-warning);
}

.wal-arrow {
  display: flex;
  align-items: center;
  font-size: 0.7rem;
  color: var(--viz-muted);
  padding-top: 2rem;
  white-space: nowrap;
}

.wal-crash-label {
  color: var(--viz-danger);
  font-weight: 700;
}

.wal-table {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 60px;
}

.wal-row {
  display: flex;
  gap: 8px;
  padding: 3px 6px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  background: rgb(16 185 129 / 8%);
}

.wal-key {
  font-weight: 700;
  color: var(--viz-text);
  min-width: 40px;
}

.wal-value {
  color: var(--viz-success);
}

.wal-empty {
  font-size: 0.7rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

.wal-crash-status {
  color: var(--viz-danger) !important;
  font-weight: 700;
}

@keyframes wal-appear {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
