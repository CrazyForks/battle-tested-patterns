<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll: clearTimers, speed, isAborted } = useVizTimers();
const { entries: logEntries, log: vizLog, clear: clearLog } = useVizLog();

interface DataVersion {
  id: number;
  version: number;
  items: string[];
  status: 'current' | 'old' | 'draft';
  modifiedIndex: number | null;
}

interface Reader {
  name: string;
  versionId: number;
  color: string;
}

interface HistoryEntry {
  actor: string;
  color: string;
  type: 'cow' | 'swap' | 'refresh' | 'gc';
  detail: string;
}

type Phase = 'idle' | 'copied' | 'swapped';

const INITIAL_ITEMS = ['A', 'B', 'C', 'D'];

let nextId = 0;
let nextVersion = 1;

const versions = ref<DataVersion[]>([
  {
    id: nextId++,
    version: nextVersion,
    items: [...INITIAL_ITEMS],
    status: 'current',
    modifiedIndex: null,
  },
]);

const readers = ref<Reader[]>([
  { name: 'R1', versionId: 0, color: 'var(--viz-primary)' },
  { name: 'R2', versionId: 0, color: 'var(--viz-success)' },
  { name: 'R3', versionId: 0, color: 'var(--viz-warning)' },
]);

const phase = ref<Phase>('idle');
const selectedIndex = ref(0);
const newValue = ref('');
const history = ref<HistoryEntry[]>([]);
const message = ref(
  t(
    'All readers share v1. Write creates a copy, swap makes it current, refresh updates readers. Linux fork() and Java CopyOnWriteArrayList use this exact pattern.',
    '所有读取者共享 v1。写入创建副本，交换使其成为当前版本，刷新更新读取者。Linux fork() 和 Java CopyOnWriteArrayList 使用完全相同的模式。',
  ),
);
let presetRunning = false;

interface CoWSnapshot {
  versions: DataVersion[];
  readers: Reader[];
  phase: string;
  opHistory: HistoryEntry[];
}

const vizHistory = useVizHistory<CoWSnapshot>(
  {
    versions: versions.value,
    readers: readers.value,
    phase: phase.value,
    opHistory: history.value,
  },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      versions.value = snap.versions;
      readers.value = snap.readers;
      phase.value = snap.phase as Phase;
      history.value = snap.opHistory;
      if (msg !== undefined) message.value = msg;
    },
  },
);

function commitVizSnapshot(label: string) {
  vizHistory.commit(
    {
      versions: versions.value,
      readers: readers.value,
      phase: phase.value,
      opHistory: history.value,
    },
    label,
  );
}

const currentVersion = computed(() => versions.value.find((v) => v.status === 'current'));

function getVersionForReader(r: Reader): DataVersion | undefined {
  return versions.value.find((v) => v.id === r.versionId);
}

function readersForVersion(vId: number): Reader[] {
  return readers.value.filter((r) => r.versionId === vId);
}

const versionGroups = computed(() => {
  return [...versions.value]
    .sort((a, b) => a.version - b.version)
    .map((v) => ({
      version: v,
      readers: readersForVersion(v.id),
      readerCount: readersForVersion(v.id).length,
    }));
});

const canWrite = computed(() => phase.value !== 'copied');
const canSwap = computed(() => phase.value === 'copied');
const canRefresh = computed(() => {
  if (phase.value === 'copied') return false;
  const cur = currentVersion.value;
  if (!cur) return false;
  return readers.value.some((r) => r.versionId !== cur.id);
});

function addHistory(entry: HistoryEntry) {
  history.value = [entry, ...history.value].slice(0, 12);
}

function doWrite() {
  if (!canWrite.value) return;

  const val = newValue.value.trim();
  if (!val) {
    message.value = t('Enter a new value first.', '请先输入新值。');
    return;
  }

  const current = currentVersion.value;
  if (!current) return;

  const oldVal = current.items[selectedIndex.value];
  nextVersion++;
  const copy: DataVersion = {
    id: nextId++,
    version: nextVersion,
    items: [...current.items],
    status: 'draft',
    modifiedIndex: selectedIndex.value,
  };
  copy.items[selectedIndex.value] = val;
  versions.value.push(copy);
  phase.value = 'copied';

  addHistory({
    actor: 'W',
    color: 'var(--viz-danger)',
    type: 'cow',
    detail: t(
      `Copy v${current.version} -> v${copy.version}, [${selectedIndex.value}]: "${oldVal}" -> "${val}"`,
      `复制 v${current.version} -> v${copy.version}，[${selectedIndex.value}]："${oldVal}" -> "${val}"`,
    ),
  });

  message.value = t(
    `Copied v${current.version} -> v${copy.version}, changed [${selectedIndex.value}] to "${val}". Readers still see v${current.version} — zero reader disruption. Click "Swap" for atomic pointer update.`,
    `已复制 v${current.version} -> v${copy.version}，将 [${selectedIndex.value}] 改为 "${val}"。读取者仍然看到 v${current.version} — 零读取中断。点击"交换"进行原子指针更新。`,
  );
  vizLog(message.value, 'info');
  commitVizSnapshot('copy');
}

function doSwap() {
  if (!canSwap.value) return;

  const draft = versions.value.find((v) => v.status === 'draft');
  const current = currentVersion.value;
  if (!draft || !current) return;

  current.status = 'old';
  draft.status = 'current';
  phase.value = 'swapped';
  newValue.value = '';

  addHistory({
    actor: 'W',
    color: 'var(--viz-danger)',
    type: 'swap',
    detail: t(
      `Atomic swap: v${draft.version} is now current, v${current.version} is old`,
      `原子交换：v${draft.version} 变为当前版本，v${current.version} 变为旧版`,
    ),
  });

  message.value = t(
    `Swapped! v${draft.version} is now current. Old readers still see v${current.version} safely — this is the RCU (Read-Copy-Update) grace period used in Linux kernel.`,
    `已交换！v${draft.version} 现在是当前版本。旧读取者仍然安全地看到 v${current.version} — 这是 Linux 内核中使用的 RCU（读-复制-更新）宽限期。`,
  );
  vizLog(message.value, 'success');
  commitVizSnapshot('swap');
}

function refreshReaders() {
  const current = currentVersion.value;
  if (!current) return;

  const staleReaders = readers.value.filter((r) => r.versionId !== current.id);
  const staleNames = staleReaders.map((r) => r.name).join(', ');

  for (const r of readers.value) {
    r.versionId = current.id;
  }

  const before = versions.value.length;
  versions.value = versions.value.filter(
    (v) => v.status === 'current' || v.status === 'draft' || readersForVersion(v.id).length > 0,
  );
  const gcCount = before - versions.value.length;

  phase.value = 'idle';

  if (staleNames) {
    addHistory({
      actor: staleNames,
      color: 'var(--viz-primary)',
      type: 'refresh',
      detail: t(
        `${staleNames} updated to v${current.version}`,
        `${staleNames} 已更新到 v${current.version}`,
      ),
    });
  }

  if (gcCount > 0) {
    addHistory({
      actor: 'GC',
      color: 'var(--viz-muted)',
      type: 'gc',
      detail: t(`${gcCount} unreferenced version(s) collected`, `${gcCount} 个未引用版本已回收`),
    });
  }

  message.value = t(
    `All readers now see v${current.version}. ${gcCount > 0 ? `${gcCount} old version(s) garbage collected — no readers referenced them.` : ''} In Linux RCU, this is synchronize_rcu() — wait for all readers to exit the critical section.`,
    `所有读取者现在看到 v${current.version}。${gcCount > 0 ? `${gcCount} 个旧版本已垃圾回收 — 没有读取者引用它们。` : ''}在 Linux RCU 中，这是 synchronize_rcu() — 等待所有读取者退出临界区。`,
  );
  vizLog(message.value, 'success');
  commitVizSnapshot('refresh');
}

function reset() {
  clearTimers();
  nextId = 0;
  nextVersion = 1;
  versions.value = [
    {
      id: nextId++,
      version: nextVersion,
      items: [...INITIAL_ITEMS],
      status: 'current',
      modifiedIndex: null,
    },
  ];
  readers.value = [
    { name: 'R1', versionId: 0, color: 'var(--viz-primary)' },
    { name: 'R2', versionId: 0, color: 'var(--viz-success)' },
    { name: 'R3', versionId: 0, color: 'var(--viz-warning)' },
  ];
  phase.value = 'idle';
  selectedIndex.value = 0;
  newValue.value = '';
  history.value = [];
  presetRunning = false;
  message.value = t('Reset. All readers share v1 again.', '已重置。所有读取者再次共享 v1。');
  clearLog();
  vizHistory.reset();
}

async function presetFullCycle() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Full CoW cycle: write → copy → swap → refresh → GC. This is exactly how Linux fork() works — the child gets a CoW copy of the parent's page tables.",
    '完整 CoW 周期：写入 → 复制 → 交换 → 刷新 → GC。这正是 Linux fork() 的工作方式 — 子进程获得父进程页表的 CoW 副本。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  newValue.value = 'X';
  selectedIndex.value = 1;
  doWrite();
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  doSwap();
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  refreshReaders();
  await delay(800);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'Complete cycle done. Key insight: readers were never blocked. This is why CoW enables lock-free reads — the foundation of MVCC in databases (PostgreSQL, CockroachDB).',
    '完整周期完成。核心洞察：读取者从未被阻塞。这就是 CoW 实现无锁读取的原因 — 数据库 MVCC 的基础（PostgreSQL、CockroachDB）。',
  );
  vizLog(message.value, 'success');
  vizLog(
    t(
      'CoW: readers never block — the foundation of lock-free reads',
      'CoW：读者永不阻塞 — 无锁读取的基础',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetMultipleWrites() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Multiple writes without refresh — old versions accumulate. This is the memory pressure problem in MVCC: PostgreSQL needs VACUUM to clean up old tuple versions.',
    '多次写入不刷新 — 旧版本积累。这是 MVCC 中的内存压力问题：PostgreSQL 需要 VACUUM 来清理旧的元组版本。',
  );
  await delay(800);
  if (isAborted()) return;

  const writes = [
    { idx: 0, val: 'X' },
    { idx: 2, val: 'Y' },
    { idx: 3, val: 'Z' },
  ];

  for (const w of writes) {
    if (!presetRunning || isAborted()) return;
    newValue.value = w.val;
    selectedIndex.value = w.idx;
    doWrite();
    await delay(600);
    if (!presetRunning || isAborted()) return;
    doSwap();
    await delay(600);
    if (!presetRunning || isAborted()) return;
  }

  message.value = t(
    `${versions.value.length} versions exist — readers still on v1 prevent GC. Click "Refresh Readers" to release old versions. This is why long-running queries in PostgreSQL block VACUUM.`,
    `${versions.value.length} 个版本存在 — 读取者仍在 v1 上阻止 GC。点击"刷新读取者"释放旧版本。这就是 PostgreSQL 中长时间查询阻止 VACUUM 的原因。`,
  );
  vizLog(message.value, 'warning');
  vizLog(
    t(
      'Version accumulation: long-lived readers block GC (PostgreSQL VACUUM)',
      '版本积累：长生命周期读者阻止 GC（PostgreSQL VACUUM）',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetConcurrentRead() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Concurrent read demo: a write happens while readers are active. Readers continue seeing the old version — zero contention. This is snapshot isolation in databases.',
    '并发读取演示：读取者活跃时发生写入。读取者继续看到旧版本 — 零争用。这是数据库中的快照隔离。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  newValue.value = 'NEW';
  selectedIndex.value = 0;
  doWrite();
  message.value = t(
    'Write created v2 (draft) — but R1, R2, R3 still safely read v1. No locks, no blocking, no torn reads. This is the power of copy-on-write.',
    '写入创建了 v2（草稿）— 但 R1、R2、R3 仍安全读取 v1。没有锁，没有阻塞，没有撕裂读取。这就是写时复制的力量。',
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;

  doSwap();
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'v2 is now current. New readers would see v2, but existing R1/R2/R3 still have v1. In Java CopyOnWriteArrayList, iterators hold a snapshot of the array at creation time.',
    'v2 现在是当前版本。新读取者看到 v2，但现有 R1/R2/R3 仍持有 v1。在 Java CopyOnWriteArrayList 中，迭代器持有创建时数组的快照。',
  );
  vizLog(
    t('Snapshot isolation: writers and readers never contend', '快照隔离：写者与读者永不争用'),
    'highlight',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Copy-on-Write', '交互式 Copy-on-Write') }}</div>

    <!-- Step progress -->
    <div class="cow-steps">
      <div
        class="cow-step"
        :class="{
          'cow-step--active': phase === 'idle',
          'cow-step--done': phase === 'copied' || phase === 'swapped',
        }"
      >
        <span class="cow-step-num">1</span>
        <span class="cow-step-text">{{ t('Write', '写入') }}</span>
      </div>
      <div class="cow-step-arrow">&rarr;</div>
      <div
        class="cow-step"
        :class="{
          'cow-step--active': phase === 'copied',
          'cow-step--done': phase === 'swapped',
        }"
      >
        <span class="cow-step-num">2</span>
        <span class="cow-step-text">{{ t('Swap', '交换') }}</span>
      </div>
      <div class="cow-step-arrow">&rarr;</div>
      <div class="cow-step" :class="{ 'cow-step--active': phase === 'swapped' }">
        <span class="cow-step-num">3</span>
        <span class="cow-step-text">{{ t('Refresh', '刷新') }}</span>
      </div>
    </div>

    <!-- Main visualization: version groups with clustered readers -->
    <div class="cow-groups">
      <div
        v-for="group in versionGroups"
        :key="group.version.id"
        class="cow-group"
        :class="{
          'cow-group--current': group.version.status === 'current',
          'cow-group--old': group.version.status === 'old',
          'cow-group--draft': group.version.status === 'draft',
        }"
      >
        <!-- Version block -->
        <div class="cow-version">
          <div class="cow-version-header">
            <span class="cow-version-label">v{{ group.version.version }}</span>
            <span
              class="cow-version-badge"
              :class="{
                'cow-badge--current': group.version.status === 'current',
                'cow-badge--old': group.version.status === 'old',
                'cow-badge--draft': group.version.status === 'draft',
              }"
            >
              {{
                group.version.status === 'current'
                  ? t('current', '当前')
                  : group.version.status === 'old'
                    ? t('old', '旧版')
                    : t('copy', '副本')
              }}
            </span>
            <span
              class="cow-rc-badge"
              :class="{
                'cow-rc--shared': group.readerCount > 1,
                'cow-rc--exclusive': group.readerCount === 1,
                'cow-rc--zero': group.readerCount === 0,
              }"
            >
              {{ t('refs', '引用') }}={{ group.readerCount }}
            </span>
          </div>
          <div class="cow-items">
            <div
              v-for="(item, i) in group.version.items"
              :key="i"
              class="cow-item"
              :class="{ 'cow-item--modified': group.version.modifiedIndex === i }"
            >
              <div class="cow-item-idx">[{{ i }}]</div>
              <div class="cow-item-val">{{ item }}</div>
            </div>
          </div>
        </div>

        <div class="cow-connectors" v-if="group.readerCount > 0">
          <div
            v-for="r in group.readers"
            :key="'line-' + r.name"
            class="cow-connector"
            :style="{ background: r.color }"
          ></div>
        </div>

        <div class="cow-readers-cluster">
          <div
            v-for="r in group.readers"
            :key="'r-' + r.name"
            class="cow-reader"
            :style="{ borderColor: r.color }"
          >
            <span class="cow-reader-dot" :style="{ background: r.color }">{{ r.name }}</span>
            <span class="cow-reader-ref">&rarr; v{{ getVersionForReader(r)?.version ?? '?' }}</span>
          </div>
          <div v-if="group.readerCount === 0" class="cow-no-readers">
            {{ t('no readers', '无读取者') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Edit controls -->
    <div class="cow-edit-area">
      <div class="cow-section-title">{{ t('Write Operation', '写入操作') }}</div>
      <div class="cow-edit-row">
        <label class="viz-label">{{ t('Element:', '元素：') }}</label>
        <select v-model.number="selectedIndex" class="cow-select" :disabled="phase === 'copied'">
          <option v-for="(item, i) in currentVersion?.items ?? []" :key="i" :value="i">
            [{{ i }}] {{ item }}
          </option>
        </select>
        <span class="cow-edit-arrow">&rarr;</span>
        <input
          v-model="newValue"
          class="cow-input"
          :placeholder="t('new value', '新值')"
          :disabled="phase === 'copied'"
          maxlength="12"
          @keyup.enter="doWrite"
        />
      </div>
    </div>

    <!-- Action buttons -->
    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" :disabled="!canWrite" @click="doWrite">
        {{ t('Write (Copy+Modify)', '写入 (复制+修改)') }}
      </button>
      <button class="viz-btn viz-btn--primary" :disabled="!canSwap" @click="doSwap">
        {{ t('Swap', '交换') }}
      </button>
      <button class="viz-btn" :disabled="!canRefresh" @click="refreshReaders">
        {{ t('Refresh Readers', '刷新读取者') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">
        {{ t('Reset', '重置') }}
      </button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetFullCycle">{{ t('Full Cycle', '完整周期') }}</button>
      <button class="viz-btn" @click="presetMultipleWrites">
        {{ t('Version Pile-up', '版本堆积') }}
      </button>
      <button class="viz-btn" @click="presetConcurrentRead">
        {{ t('Concurrent Read', '并发读取') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />

    <!-- Operation history -->
    <div class="cow-history" v-if="history.length > 0">
      <div class="cow-section-title">{{ t('Operation History', '操作历史') }}</div>
      <div class="cow-history-list">
        <div
          v-for="(entry, i) in history"
          :key="i"
          class="cow-history-entry"
          :class="{ 'cow-history-entry--latest': i === 0 }"
        >
          <span class="cow-history-who" :style="{ color: entry.color }">{{ entry.actor }}</span>
          <span
            class="cow-history-type"
            :class="{
              'cow-ht--cow': entry.type === 'cow',
              'cow-ht--swap': entry.type === 'swap',
              'cow-ht--refresh': entry.type === 'refresh',
              'cow-ht--gc': entry.type === 'gc',
            }"
          >
            {{
              entry.type === 'cow'
                ? t('CoW', 'CoW')
                : entry.type === 'swap'
                  ? t('Swap', '交换')
                  : entry.type === 'refresh'
                    ? t('Refresh', '刷新')
                    : t('GC', 'GC')
            }}
          </span>
          <span class="cow-history-detail">{{ entry.detail }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Step progress indicator */
.cow-steps {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  flex-wrap: wrap;
}

.cow-step {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border: 2px solid var(--viz-border);
  border-radius: 999px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  transition: all var(--viz-transition);
}

.cow-step--active {
  border-color: var(--viz-primary);
  color: var(--viz-primary);
  background: color-mix(in srgb, var(--viz-primary) 8%, var(--vp-c-bg));
}

.cow-step--done {
  border-color: var(--viz-success);
  color: var(--viz-success);
  background: color-mix(in srgb, var(--viz-success) 8%, var(--vp-c-bg));
}

.cow-step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--viz-border);
  color: var(--vp-c-bg);
  font-size: 0.625rem;
  font-weight: 700;
}

.cow-step--active .cow-step-num {
  background: var(--viz-primary);
}

.cow-step--done .cow-step-num {
  background: var(--viz-success);
}

.cow-step-text {
  font-weight: 600;
}

.cow-step-arrow {
  color: var(--viz-muted);
  font-size: 0.75rem;
}

/* Section titles */
.cow-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-muted);
  margin-bottom: 0.375rem;
}

/* --- Main grouped layout --- */
.cow-groups {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.75rem 0;
}

.cow-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  min-width: 140px;
  flex: 1;
  max-width: 240px;
}

.cow-group--draft {
  animation: cow-appear 0.4s ease;
}

.cow-group--old {
  opacity: 0.55;
}

/* --- Version block --- */
.cow-version {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  transition: all var(--viz-transition);
}

.cow-group--current .cow-version {
  border-color: var(--viz-primary);
}

.cow-group--draft .cow-version {
  border-color: var(--viz-warning);
  border-style: dashed;
}

.cow-version-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
  flex-wrap: wrap;
}

.cow-version-label {
  font-size: 0.875rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.cow-version-badge {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.1rem 0.35rem;
  border-radius: var(--viz-radius-sm);
}

.cow-badge--current {
  background: color-mix(in srgb, var(--viz-primary) 15%, var(--vp-c-bg));
  color: var(--viz-primary);
}

.cow-badge--old {
  background: color-mix(in srgb, var(--viz-muted) 15%, var(--vp-c-bg));
  color: var(--viz-muted);
}

.cow-badge--draft {
  background: color-mix(in srgb, var(--viz-warning) 15%, var(--vp-c-bg));
  color: var(--viz-warning);
}

/* Ref count badge */
.cow-rc-badge {
  margin-left: auto;
  font-size: 0.65rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  padding: 0.1rem 0.4rem;
  border-radius: var(--viz-radius-md);
  line-height: 1.4;
}

.cow-rc--shared {
  background: var(--viz-warning);
  color: #fff;
}

.cow-rc--exclusive {
  background: var(--viz-success);
  color: #fff;
}

.cow-rc--zero {
  background: var(--viz-border);
  color: var(--viz-muted);
}

/* Data items */
.cow-items {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.cow-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 36px;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  transition: all var(--viz-transition);
}

.cow-item--modified {
  border-color: var(--viz-warning);
  background: color-mix(in srgb, var(--viz-warning) 12%, var(--vp-c-bg));
  animation: cow-highlight 0.5s ease;
}

.cow-item-idx {
  font-size: 0.6rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.cow-item-val {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

/* --- Connection lines --- */
.cow-connectors {
  display: flex;
  gap: 6px;
  padding: 2px 0;
}

.cow-connector {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  opacity: 0.7;
}

/* --- Clustered readers --- */
.cow-readers-cluster {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.cow-reader {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.3rem 0.5rem;
  border: 2px solid;
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  transition: all var(--viz-transition);
}

.cow-reader-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.cow-reader-ref {
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.cow-no-readers {
  font-size: 0.65rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
  padding: 4px 0;
}

/* --- Edit area --- */
.cow-edit-area {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg-soft);
  margin-bottom: 0.5rem;
}

.cow-edit-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.cow-select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.cow-input {
  width: 90px;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.cow-select:focus,
.cow-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

.cow-select:disabled,
.cow-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cow-edit-arrow {
  color: var(--viz-muted);
  font-size: 0.875rem;
}

/* --- Operation history --- */
.cow-history {
  margin-top: 0.75rem;
}

.cow-history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 130px;
  overflow-y: auto;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
}

.cow-history-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  padding: 2px 0;
  opacity: 0.65;
}

.cow-history-entry--latest {
  opacity: 1;
  font-weight: 600;
}

.cow-history-who {
  font-weight: 700;
  min-width: 16px;
  flex-shrink: 0;
}

.cow-history-type {
  padding: 0 4px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.6rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.cow-ht--cow {
  background: var(--viz-warning);
  color: #fff;
}

.cow-ht--swap {
  background: var(--viz-primary);
  color: #fff;
}

.cow-ht--refresh {
  background: var(--viz-success);
  color: #fff;
}

.cow-ht--gc {
  background: var(--viz-border);
  color: var(--viz-muted);
}

.cow-history-detail {
  color: var(--viz-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Animations */
@keyframes cow-appear {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes cow-highlight {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
  }
}

/* Responsive */
@media (width <= 640px) {
  .cow-steps {
    gap: 0.25rem;
  }

  .cow-step {
    padding: 0.2rem 0.5rem;
    font-size: 0.6875rem;
  }

  .cow-groups {
    flex-direction: column;
  }

  .cow-group {
    max-width: 100%;
  }

  .cow-items {
    gap: 0.25rem;
  }

  .cow-item {
    min-width: 30px;
    padding: 0.15rem 0.3rem;
  }

  .cow-item-val {
    font-size: 0.75rem;
  }

  .cow-edit-row {
    gap: 0.25rem;
  }

  .cow-input {
    width: 70px;
  }

  .cow-history-entry {
    flex-wrap: wrap;
    gap: 3px;
  }

  .cow-history-detail {
    white-space: normal;
  }
}
</style>
