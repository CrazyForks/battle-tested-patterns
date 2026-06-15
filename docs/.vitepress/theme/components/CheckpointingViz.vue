<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeTimeout, clearAll, delay, speed, isAborted } = useVizTimers();
const { entries: logEntries, log: vizLog, clear: clearLog } = useVizLog();

interface LogEntry {
  id: number;
  op: string;
  value: number;
  afterCheckpoint: boolean;
}

interface Checkpoint {
  id: number;
  stateValue: number;
  afterLogId: number;
  timestamp: string;
}

let nextEntryId = 1;
let nextCpId = 1;

const stateValue = ref(0);
const log = ref<LogEntry[]>([]);
const checkpoints = ref<Checkpoint[]>([]);
const crashed = ref(false);
const recovering = ref(false);
const replayedCount = ref(0);
const totalEntries = ref(0);
const highlightedEntries = ref<Set<number>>(new Set());

interface CpSnapshot {
  stateValue: number;
  log: LogEntry[];
  checkpoints: Checkpoint[];
  crashed: boolean;
}

const vizHistory = useVizHistory<CpSnapshot>(
  { stateValue: 0, log: [], checkpoints: [], crashed: false },
  {
    getMessage: () => message.value,
    onRestore(snapshot, msg) {
      presetRunning = false;
      clearAll();
      recovering.value = false;
      stateValue.value = snapshot.stateValue;
      log.value = snapshot.log;
      checkpoints.value = snapshot.checkpoints;
      crashed.value = snapshot.crashed;
      highlightedEntries.value = new Set();
      if (msg !== undefined) message.value = msg;
    },
  },
);

const message = ref(
  t(
    'Perform operations to build a WAL, then checkpoint to save snapshots — or pick a scenario below',
    '执行操作以构建 WAL，然后通过 Checkpoint 保存快照 — 或选择下方场景',
  ),
);
let presetRunning = false;

function now(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const lastCheckpoint = computed(() => {
  return checkpoints.value.length > 0 ? checkpoints.value[checkpoints.value.length - 1] : null;
});

const ops = [
  { label: '+3', delta: 3 },
  { label: '+7', delta: 7 },
  { label: '*2', delta: 0, mul: true },
  { label: '-5', delta: -5 },
];

function applyOp(op: (typeof ops)[0]) {
  if (crashed.value) {
    message.value = t(
      'State is corrupted! Recover from checkpoint first',
      '状态已损坏！请先从 Checkpoint 恢复',
    );
    return;
  }
  const before = stateValue.value;
  if (op.mul) {
    stateValue.value = stateValue.value * 2;
  } else {
    stateValue.value += op.delta;
  }
  const entry: LogEntry = {
    id: nextEntryId++,
    op: op.label,
    value: stateValue.value,
    afterCheckpoint: false,
  };
  log.value = [...log.value, entry];
  message.value = t(
    `Op ${op.label}: ${before} -> ${stateValue.value} (entry #${entry.id}). Each operation is logged sequentially — the WAL is the source of truth, not the in-memory state.`,
    `操作 ${op.label}：${before} -> ${stateValue.value}（条目 #${entry.id}）。每个操作按顺序记录 — WAL 是真相来源，而非内存状态。`,
  );
  vizHistory.commit(
    {
      stateValue: stateValue.value,
      log: log.value,
      checkpoints: checkpoints.value,
      crashed: crashed.value,
    },
    `op ${op.label}`,
  );
}

function checkpoint() {
  if (crashed.value) {
    message.value = t('Cannot checkpoint corrupted state', '无法对损坏状态进行 Checkpoint');
    return;
  }
  const cp: Checkpoint = {
    id: nextCpId++,
    stateValue: stateValue.value,
    afterLogId: log.value.length > 0 ? log.value[log.value.length - 1].id : 0,
    timestamp: now(),
  };
  checkpoints.value = [...checkpoints.value, cp];
  log.value = log.value.map((e) => ({ ...e, afterCheckpoint: false }));
  message.value = t(
    `Checkpoint #${cp.id} saved at state=${cp.stateValue}. Entries before this can be garbage collected. PostgreSQL's CHECKPOINT command does exactly this.`,
    `Checkpoint #${cp.id} 已保存，state=${cp.stateValue}。此前的条目可被垃圾回收。PostgreSQL 的 CHECKPOINT 命令正是这样做的。`,
  );
  vizHistory.commit(
    {
      stateValue: stateValue.value,
      log: log.value,
      checkpoints: checkpoints.value,
      crashed: crashed.value,
    },
    `checkpoint #${cp.id}`,
  );
}

function crash() {
  if (crashed.value) return;
  crashed.value = true;
  stateValue.value = -1;
  totalEntries.value = log.value.length;
  message.value = t(
    'CRASH! In-memory state lost. But the WAL on disk is intact — recovery will restore from last checkpoint + replay. This is ARIES recovery protocol used by all major databases.',
    'CRASH！内存状态丢失。但磁盘上的 WAL 完好无损 — 恢复将从最后检查点 + 重放还原。这是所有主流数据库使用的 ARIES 恢复协议。',
  );
  vizHistory.commit(
    {
      stateValue: stateValue.value,
      log: log.value,
      checkpoints: checkpoints.value,
      crashed: crashed.value,
    },
    'crash',
  );
}

function recover() {
  if (!crashed.value) return;
  const cp = lastCheckpoint.value;
  if (!cp) {
    message.value = t(
      'No checkpoint available! All data lost. This is why periodic checkpointing is critical — Redis RDB snapshots prevent this scenario.',
      '没有可用的 Checkpoint！所有数据已丢失。这就是定期检查点至关重要的原因 — Redis RDB 快照防止了这种情况。',
    );
    crashed.value = false;
    stateValue.value = 0;
    log.value = [];
    vizHistory.commit(
      {
        stateValue: stateValue.value,
        log: log.value,
        checkpoints: checkpoints.value,
        crashed: crashed.value,
      },
      'recover (data lost)',
    );
    return;
  }

  recovering.value = true;
  crashed.value = false;
  stateValue.value = cp.stateValue;

  const entriesAfterCp = log.value.filter((e) => e.id > cp.afterLogId);
  replayedCount.value = entriesAfterCp.length;

  log.value = log.value.map((e) => ({
    ...e,
    afterCheckpoint: e.id > cp.afterLogId,
  }));

  highlightedEntries.value = new Set();
  let replayIdx = 0;

  function replayNext() {
    if (isAborted()) return;
    if (replayIdx >= entriesAfterCp.length) {
      recovering.value = false;
      message.value = t(
        `Recovery complete! Replayed ${replayedCount.value} of ${totalEntries.value} entries. Checkpoint saved ${totalEntries.value - replayedCount.value} replays — the larger the WAL, the more checkpoints save.`,
        `恢复完成！重放了 ${totalEntries.value} 条中的 ${replayedCount.value} 条。检查点节省了 ${totalEntries.value - replayedCount.value} 次重放 — WAL 越大，检查点节省越多。`,
      );
      vizHistory.commit(
        {
          stateValue: stateValue.value,
          log: log.value,
          checkpoints: checkpoints.value,
          crashed: crashed.value,
        },
        'recover',
      );
      return;
    }
    const entry = entriesAfterCp[replayIdx];
    highlightedEntries.value = new Set([...highlightedEntries.value, entry.id]);
    stateValue.value = entry.value;
    message.value = t(
      `Replaying entry #${entry.id}: ${entry.op} -> state=${entry.value}`,
      `重放条目 #${entry.id}：${entry.op} -> state=${entry.value}`,
    );
    replayIdx++;
    safeTimeout(replayNext, 400);
  }

  message.value = t(
    `Restored checkpoint #${cp.id} (state=${cp.stateValue}). Replaying ${entriesAfterCp.length} entries...`,
    `已恢复 Checkpoint #${cp.id}（state=${cp.stateValue}）。正在重放 ${entriesAfterCp.length} 条记录...`,
  );
  safeTimeout(replayNext, 500);
}

function reset() {
  clearAll();
  stateValue.value = 0;
  log.value = [];
  checkpoints.value = [];
  crashed.value = false;
  recovering.value = false;
  replayedCount.value = 0;
  totalEntries.value = 0;
  highlightedEntries.value = new Set();
  nextEntryId = 1;
  nextCpId = 1;
  presetRunning = false;
  vizHistory.reset();
  message.value = t('Reset. Perform operations to build a WAL', '已重置。执行操作以构建 WAL');
  clearLog();
}

function isCheckpointAfter(entryId: number): number | null {
  for (const cp of checkpoints.value) {
    if (cp.afterLogId === entryId) return cp.id;
  }
  return null;
}

async function presetCrashRecovery() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Full crash recovery demo: build WAL, checkpoint, add more ops, crash, then recover. This is the ARIES algorithm — analyze, redo, undo.',
    '完整崩溃恢复演示：构建 WAL，检查点，添加更多操作，崩溃，然后恢复。这是 ARIES 算法 — 分析、重做、撤销。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[0]); // +3
  vizLog(t('op +3 → state=3', '操作 +3 → state=3'), 'info');
  await delay(500);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[1]); // +7
  vizLog(t('op +7 → state=10', '操作 +7 → state=10'), 'info');
  await delay(500);
  if (!presetRunning || isAborted()) return;
  checkpoint();
  vizLog(t('checkpoint saved (state=10)', '检查点已保存 (state=10)'), 'info');
  await delay(800);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[2]); // *2
  vizLog(t('op *2 → state=20', '操作 *2 → state=20'), 'info');
  await delay(500);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[3]); // -5
  vizLog(t('op -5 → state=15', '操作 -5 → state=15'), 'info');
  await delay(800);
  if (!presetRunning || isAborted()) return;
  crash();
  vizLog(t('CRASH! state corrupted', '崩溃！状态损坏'), 'warning');
  await delay(1500);
  if (!presetRunning || isAborted()) return;
  recover();
  vizLog(
    t(
      'Checkpoint + WAL replay restores full state after crash — this is the ARIES recovery protocol used by all major databases.',
      '检查点 + WAL 重放在崩溃后恢复完整状态 — 这是所有主流数据库使用的 ARIES 恢复协议。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetNoCheckpoint() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Crash without checkpoint — all data lost! This shows why periodic checkpointing is essential. InnoDB auto-checkpoints every innodb_log_file_size bytes.',
    '无检查点崩溃 — 所有数据丢失！这说明了定期检查点的重要性。InnoDB 每 innodb_log_file_size 字节自动检查点。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[0]);
  vizLog(t('op +3 → state=3', '操作 +3 → state=3'), 'info');
  await delay(400);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[1]);
  vizLog(t('op +7 → state=10', '操作 +7 → state=10'), 'info');
  await delay(400);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[2]);
  vizLog(t('op *2 → state=20', '操作 *2 → state=20'), 'info');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'No checkpoint created — crashing now will lose everything. In production, this is a disaster.',
    '未创建检查点 — 现在崩溃将丢失所有数据。在生产环境中，这是灾难。',
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  crash();
  vizLog(t('CRASH! no checkpoint to recover from', '崩溃！无检查点可恢复'), 'warning');
  await delay(1500);
  if (!presetRunning || isAborted()) return;
  recover();
  vizLog(
    t(
      'Without checkpoints, crash recovery has no restore point — all WAL data is lost because there is no base state to replay from.',
      '没有检查点时，崩溃恢复没有还原点 — 所有 WAL 数据丢失，因为没有可重放的基础状态。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetFrequentCheckpoints() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Frequent checkpoints: checkpoint after every 2 operations. Minimizes replay time but increases I/O. PostgreSQL tunes this with checkpoint_timeout and max_wal_size.',
    '频繁检查点：每 2 次操作后检查点。最小化重放时间但增加 I/O。PostgreSQL 通过 checkpoint_timeout 和 max_wal_size 调整。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[0]);
  vizLog(t('op +3', '操作 +3'), 'info');
  await delay(400);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[1]);
  vizLog(t('op +7', '操作 +7'), 'info');
  await delay(400);
  if (!presetRunning || isAborted()) return;
  checkpoint();
  vizLog(t('checkpoint #1 saved', '检查点 #1 已保存'), 'info');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[2]);
  vizLog(t('op *2', '操作 *2'), 'info');
  await delay(400);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[3]);
  vizLog(t('op -5', '操作 -5'), 'info');
  await delay(400);
  if (!presetRunning || isAborted()) return;
  checkpoint();
  vizLog(t('checkpoint #2 saved', '检查点 #2 已保存'), 'info');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  applyOp(ops[0]);
  vizLog(t('op +3 (after CP#2)', '操作 +3（CP#2 后）'), 'info');
  await delay(400);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Only 1 entry after last checkpoint. If we crash now, recovery replays just 1 op instead of 5. Tradeoff: more checkpoint I/O vs. faster recovery.',
    '最后检查点后只有 1 条记录。如果现在崩溃，恢复只重放 1 个操作而非 5 个。权衡：更多检查点 I/O vs 更快恢复。',
  );
  vizLog(
    t(
      'Frequent checkpoints trade I/O cost for faster crash recovery — PostgreSQL tunes this with checkpoint_timeout and max_wal_size.',
      '频繁检查点以 I/O 成本换取更快的崩溃恢复 — PostgreSQL 通过 checkpoint_timeout 和 max_wal_size 来调整。',
    ),
    'highlight',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Checkpointing', '交互式 Checkpointing') }}</div>

    <div class="cp-layout">
      <!-- WAL Log (left) -->
      <div class="cp-wal">
        <div class="cp-section-label">{{ t('Write-Ahead Log', '预写日志') }}</div>
        <div class="cp-log-list">
          <div v-if="log.length === 0" class="cp-empty">{{ t('no entries yet', '暂无条目') }}</div>
          <template v-for="entry in log" :key="entry.id">
            <div
              class="cp-log-entry"
              :class="{
                'cp-log-entry--replaying': highlightedEntries.has(entry.id),
                'cp-log-entry--after': entry.afterCheckpoint && !highlightedEntries.has(entry.id),
              }"
            >
              <span class="cp-log-id">#{{ entry.id }}</span>
              <span class="cp-log-op">{{ entry.op }}</span>
              <span class="cp-log-arrow">-></span>
              <span class="cp-log-val">{{ entry.value }}</span>
            </div>
            <!-- Checkpoint marker -->
            <div v-if="isCheckpointAfter(entry.id)" class="cp-marker">
              <svg
                width="100%"
                height="20"
                viewBox="0 0 200 20"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line
                  x1="0"
                  y1="10"
                  x2="60"
                  y2="10"
                  stroke="var(--viz-success)"
                  stroke-width="2"
                  stroke-dasharray="4,3"
                />
                <polygon points="62,5 72,10 62,15" fill="var(--viz-success)" />
                <line
                  x1="128"
                  y1="10"
                  x2="200"
                  y2="10"
                  stroke="var(--viz-success)"
                  stroke-width="2"
                  stroke-dasharray="4,3"
                />
              </svg>
              <span class="cp-marker-label">CP #{{ isCheckpointAfter(entry.id) }}</span>
            </div>
          </template>
          <div
            v-if="
              lastCheckpoint &&
              log.length > 0 &&
              lastCheckpoint.afterLogId === log[log.length - 1]?.id
            "
          />
          <div v-if="lastCheckpoint && log.length === 0" class="cp-marker">
            <span class="cp-marker-label">CP #{{ lastCheckpoint.id }} (empty)</span>
          </div>
        </div>
      </div>

      <!-- State box (right) -->
      <div class="cp-state-panel">
        <div class="cp-section-label">{{ t('Current State', '当前状态') }}</div>
        <div
          class="cp-state-box"
          :class="{ 'cp-state-box--crashed': crashed, 'cp-state-box--recovering': recovering }"
        >
          <div v-if="!crashed" class="cp-state-value">{{ stateValue }}</div>
          <div v-else class="cp-state-corrupted">{{ t('CORRUPTED', '已损坏') }}</div>
        </div>

        <!-- Recovery stats -->
        <div v-if="replayedCount > 0 && !recovering" class="cp-recovery-stats">
          <div class="cp-recovery-stat">
            <span class="cp-recovery-num">{{ replayedCount }}</span>
            <span class="cp-recovery-label">{{ t('entries replayed', '条已重放') }}</span>
          </div>
          <div class="cp-recovery-stat">
            <span class="cp-recovery-num">{{ totalEntries }}</span>
            <span class="cp-recovery-label">{{ t('total entries', '总条目') }}</span>
          </div>
          <div class="cp-recovery-stat">
            <span class="cp-recovery-num cp-recovery-saved">{{
              totalEntries - replayedCount
            }}</span>
            <span class="cp-recovery-label">{{
              t('skipped (in checkpoint)', '已跳过（在 Checkpoint 中）')
            }}</span>
          </div>
        </div>

        <!-- Checkpoint list -->
        <div v-if="checkpoints.length > 0" class="cp-snapshots">
          <div class="cp-section-label">{{ t('Snapshots', '快照') }}</div>
          <div v-for="cp in [...checkpoints].reverse()" :key="cp.id" class="cp-snapshot">
            <span class="cp-snap-id">#{{ cp.id }}</span>
            <span class="cp-snap-val">state={{ cp.stateValue }}</span>
            <span class="cp-snap-time">{{ cp.timestamp }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button
        v-for="op in ops"
        :key="op.label"
        class="viz-btn"
        :disabled="crashed || recovering"
        @click="applyOp(op)"
      >
        {{ op.label }}
      </button>
      <button
        class="viz-btn viz-btn--primary"
        :disabled="crashed || recovering"
        @click="checkpoint"
      >
        {{ t('Checkpoint', '创建快照') }}
      </button>
      <button class="viz-btn viz-btn--danger" :disabled="crashed || recovering" @click="crash">
        {{ t('Crash', '模拟崩溃') }}
      </button>
      <button v-if="crashed" class="viz-btn viz-btn--primary" @click="recover">
        {{ t('Recover', '恢复') }}
      </button>
      <button class="viz-btn" @click="reset">{{ t('Reset', '重置') }}</button>
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
      <button class="viz-btn" @click="presetNoCheckpoint">
        {{ t('No Checkpoint', '无检查点') }}
      </button>
      <button class="viz-btn" @click="presetFrequentCheckpoints">
        {{ t('Frequent CP', '频繁检查点') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite" :class="{ 'cp-status--crash': crashed }">
      {{ message }}
    </div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.cp-layout {
  display: flex;
  gap: 1rem;
  margin: 0.5rem 0;
}

.cp-wal {
  flex: 1;
  min-width: 0;
}

.cp-state-panel {
  flex: 0 0 160px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cp-section-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-bottom: 0.25rem;
  letter-spacing: 0.03em;
}

.cp-log-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
}

.cp-log-entry {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 3px 6px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  border: 1px solid var(--viz-border);
  transition: all var(--viz-transition);
}

.cp-log-entry--replaying {
  border-color: var(--viz-warning);
  background: rgb(245 158 11 / 12%);
  animation: cp-replay-flash 0.4s ease;
}

.cp-log-entry--after {
  border-color: var(--viz-warning);
  opacity: 0.7;
}

.cp-log-id {
  font-weight: 700;
  color: var(--viz-muted);
  min-width: 22px;
}

.cp-log-op {
  font-weight: 700;
  color: var(--viz-primary);
  min-width: 20px;
}

.cp-log-arrow {
  color: var(--viz-muted);
}

.cp-log-val {
  color: var(--viz-text);
  font-weight: 600;
}

.cp-marker {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 2px 0;
  position: relative;
}

.cp-marker svg {
  flex-shrink: 0;
  width: 60px;
  height: 16px;
}

.cp-marker-label {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--viz-success);
  white-space: nowrap;
}

.cp-state-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 0.5rem;
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  transition: all var(--viz-transition);
}

.cp-state-box--crashed {
  border-color: var(--viz-danger);
  background: rgb(239 68 68 / 6%);
  animation: cp-shake 0.4s ease;
}

.cp-state-box--recovering {
  border-color: var(--viz-warning);
  background: rgb(245 158 11 / 6%);
}

.cp-state-value {
  font-size: 2rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.cp-state-corrupted {
  font-size: 1rem;
  font-weight: 700;
  color: var(--viz-danger);
  letter-spacing: 0.05em;
}

.cp-recovery-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-recovery-stat {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.cp-recovery-num {
  font-size: 0.875rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.cp-recovery-saved {
  color: var(--viz-success);
}

.cp-recovery-label {
  font-size: 0.625rem;
  color: var(--viz-muted);
}

.cp-snapshots {
  margin-top: 0.25rem;
}

.cp-snapshot {
  display: flex;
  flex-direction: column;
  padding: 3px 6px;
  border-radius: var(--viz-radius-sm);
  background: rgb(16 185 129 / 8%);
  border: 1px solid rgb(16 185 129 / 20%);
  margin-bottom: 2px;
}

.cp-snap-id {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--viz-success);
  font-family: var(--vp-font-family-mono);
}

.cp-snap-val {
  font-size: 0.625rem;
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.cp-snap-time {
  font-size: 0.5625rem;
  color: var(--viz-muted);
}

.cp-empty {
  font-size: 0.75rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
  padding: 1.5rem 0;
}

.cp-status--crash {
  color: var(--viz-danger) !important;
  font-weight: 700;
}

@keyframes cp-shake {
  0%,
  100% {
    transform: translateX(0);
  }

  20% {
    transform: translateX(-4px);
  }

  40% {
    transform: translateX(4px);
  }

  60% {
    transform: translateX(-3px);
  }

  80% {
    transform: translateX(2px);
  }
}

@keyframes cp-replay-flash {
  0% {
    background: rgb(245 158 11 / 30%);
  }

  100% {
    background: rgb(245 158 11 / 12%);
  }
}

@media (width <= 640px) {
  .cp-layout {
    flex-direction: column;
  }

  .cp-state-panel {
    flex: none;
  }

  .cp-log-list {
    max-height: 160px;
  }
}
</style>
