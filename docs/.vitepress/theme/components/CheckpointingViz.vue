<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
let aborted = false;
onUnmounted(() => { aborted = true; for (const tid of pendingTimers) clearTimeout(tid); });

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
const message = ref(t('Perform operations to build a WAL, then checkpoint to save snapshots', '执行操作以构建 WAL，然后通过 Checkpoint 保存快照'));

function now(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const lastCheckpoint = computed(() => {
  return checkpoints.value.length > 0
    ? checkpoints.value[checkpoints.value.length - 1]
    : null;
});

const ops = [
  { label: '+3', delta: 3 },
  { label: '+7', delta: 7 },
  { label: '*2', delta: 0, mul: true },
  { label: '-5', delta: -5 },
];

function applyOp(op: typeof ops[0]) {
  if (crashed.value) {
    message.value = t('State is corrupted! Recover from checkpoint first', '状态已损坏！请先从 Checkpoint 恢复');
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
  message.value = t(`Op ${op.label}: ${before} -> ${stateValue.value} (logged as entry #${entry.id})`, `操作 ${op.label}：${before} -> ${stateValue.value}（记录为条目 #${entry.id}）`);
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
  // Mark all current entries as before this checkpoint
  log.value = log.value.map(e => ({ ...e, afterCheckpoint: false }));
  message.value = t(`Checkpoint #${cp.id} saved at state=${cp.stateValue} after log entry #${cp.afterLogId}`, `Checkpoint #${cp.id} 已保存，state=${cp.stateValue}，位于日志条目 #${cp.afterLogId} 之后`);
}

function crash() {
  if (crashed.value) return;
  crashed.value = true;
  stateValue.value = -1;
  totalEntries.value = log.value.length;
  message.value = t('CRASH! State corrupted. Use "Recover" to restore from last checkpoint and replay WAL', 'CRASH！状态已损坏。使用"恢复"从最近的 Checkpoint 恢复并重放 WAL');
}

function recover() {
  if (!crashed.value) return;
  const cp = lastCheckpoint.value;
  if (!cp) {
    message.value = t('No checkpoint available! All data is lost.', '没有可用的 Checkpoint！所有数据已丢失。');
    crashed.value = false;
    stateValue.value = 0;
    log.value = [];
    return;
  }

  recovering.value = true;
  crashed.value = false;

  // Restore to checkpoint state
  stateValue.value = cp.stateValue;

  // Find entries after the checkpoint
  const entriesAfterCp = log.value.filter(e => e.id > cp.afterLogId);
  replayedCount.value = entriesAfterCp.length;

  // Mark entries that need replay
  log.value = log.value.map(e => ({
    ...e,
    afterCheckpoint: e.id > cp.afterLogId,
  }));

  // Animate replay
  highlightedEntries.value = new Set();
  let replayIdx = 0;

  function replayNext() {
    if (aborted) return;
    if (replayIdx >= entriesAfterCp.length) {
      recovering.value = false;
      message.value = t(`Recovery complete! Replayed ${replayedCount.value} of ${totalEntries.value} entries from checkpoint #${cp!.id}`, `恢复完成！从 Checkpoint #${cp!.id} 重放了 ${totalEntries.value} 条中的 ${replayedCount.value} 条`);
      return;
    }
    const entry = entriesAfterCp[replayIdx];
    highlightedEntries.value = new Set([...highlightedEntries.value, entry.id]);
    stateValue.value = entry.value;
    message.value = t(`Replaying entry #${entry.id}: ${entry.op} -> state=${entry.value}`, `重放条目 #${entry.id}：${entry.op} -> state=${entry.value}`);
    replayIdx++;
    const tid = setTimeout(() => { pendingTimers.delete(tid); replayNext(); }, 400);
    pendingTimers.add(tid);
  }

  message.value = t(`Restored checkpoint #${cp.id} (state=${cp.stateValue}). Replaying ${entriesAfterCp.length} entries...`, `已恢复 Checkpoint #${cp.id}（state=${cp.stateValue}）。正在重放 ${entriesAfterCp.length} 条记录...`);
  const tid0 = setTimeout(() => { pendingTimers.delete(tid0); replayNext(); }, 500);
  pendingTimers.add(tid0);
}

function reset() {
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
  message.value = t('Reset. Perform operations to build a WAL', '已重置。执行操作以构建 WAL');
}

function isCheckpointAfter(entryId: number): number | null {
  for (const cp of checkpoints.value) {
    if (cp.afterLogId === entryId) return cp.id;
  }
  return null;
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
              <svg width="100%" height="20" viewBox="0 0 200 20" preserveAspectRatio="none">
                <line x1="0" y1="10" x2="60" y2="10" stroke="var(--viz-success)" stroke-width="2" stroke-dasharray="4,3"/>
                <polygon points="62,5 72,10 62,15" fill="var(--viz-success)"/>
                <line x1="128" y1="10" x2="200" y2="10" stroke="var(--viz-success)" stroke-width="2" stroke-dasharray="4,3"/>
              </svg>
              <span class="cp-marker-label">CP #{{ isCheckpointAfter(entry.id) }}</span>
            </div>
          </template>
          <!-- Checkpoint at end if last checkpoint is after last entry -->
          <div v-if="lastCheckpoint && log.length > 0 && lastCheckpoint.afterLogId === log[log.length - 1]?.id" />
          <div v-if="lastCheckpoint && log.length === 0" class="cp-marker">
            <span class="cp-marker-label">CP #{{ lastCheckpoint.id }} (empty)</span>
          </div>
        </div>
      </div>

      <!-- State box (right) -->
      <div class="cp-state-panel">
        <div class="cp-section-label">{{ t('Current State', '当前状态') }}</div>
        <div class="cp-state-box" :class="{ 'cp-state-box--crashed': crashed, 'cp-state-box--recovering': recovering }">
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
            <span class="cp-recovery-num cp-recovery-saved">{{ totalEntries - replayedCount }}</span>
            <span class="cp-recovery-label">{{ t('skipped (in checkpoint)', '已跳过（在 Checkpoint 中）') }}</span>
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
      >{{ op.label }}</button>
      <button class="viz-btn viz-btn--primary" :disabled="crashed || recovering" @click="checkpoint">{{ t('Checkpoint', '创建快照') }}</button>
      <button class="viz-btn viz-btn--danger" :disabled="crashed || recovering" @click="crash">{{ t('Crash', '模拟崩溃') }}</button>
      <button v-if="crashed" class="viz-btn viz-btn--primary" @click="recover">{{ t('Recover', '恢复') }}</button>
      <button class="viz-btn" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status" :class="{ 'cp-status--crash': crashed }">{{ message }}</div>
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
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  border: 1px solid var(--viz-border);
  transition: all 0.2s ease;
}

.cp-log-entry--replaying {
  border-color: var(--viz-warning);
  background: rgba(245, 158, 11, 0.12);
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
  border-radius: 8px;
  background: var(--vp-c-bg);
  transition: all 0.3s ease;
}

.cp-state-box--crashed {
  border-color: var(--viz-danger);
  background: rgba(239, 68, 68, 0.06);
  animation: cp-shake 0.4s ease;
}

.cp-state-box--recovering {
  border-color: var(--viz-warning);
  background: rgba(245, 158, 11, 0.06);
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
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
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

.viz-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes cp-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}

@keyframes cp-replay-flash {
  0% { background: rgba(245, 158, 11, 0.3); }
  100% { background: rgba(245, 158, 11, 0.12); }
}

@media (max-width: 640px) {
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
