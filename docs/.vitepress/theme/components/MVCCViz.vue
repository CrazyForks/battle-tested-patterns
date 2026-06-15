<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface Version {
  ver: number;
  value: string;
  txnId: number;
}

interface KeyVersions {
  key: string;
  versions: Version[];
}

interface Transaction {
  id: number;
  snapshotVer: number;
  status: 'active' | 'committed' | 'aborted';
  writes: { key: string; value: string }[];
}

const globalVer = ref(1);
let txnCounter = 0;
let presetRunning = false;

const store = ref<KeyVersions[]>([
  { key: 'user', versions: [{ ver: 1, value: '"alice"', txnId: 0 }] },
  { key: 'balance', versions: [{ ver: 1, value: '100', txnId: 0 }] },
]);

const transactions = ref<Transaction[]>([]);

interface MVCCSnapshot {
  globalVer: number;
  store: KeyVersions[];
  transactions: Transaction[];
}

const vizHistory = useVizHistory<MVCCSnapshot>(
  {
    globalVer: 1,
    store: JSON.parse(JSON.stringify(store.value)),
    transactions: [],
  },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      globalVer.value = snap.globalVer;
      store.value = snap.store;
      transactions.value = snap.transactions;
      highlightKey.value = '';
      highlightVer.value = -1;
      selectedTxn.value = null;
      if (msg !== undefined) message.value = msg;
    },
  },
);

const message = ref(
  t(
    'Begin a transaction to start. Each gets a snapshot version — this is how PostgreSQL, MySQL InnoDB, and CockroachDB achieve isolation without locks.',
    '开始一个事务。每个事务获取一个快照版本 — PostgreSQL、MySQL InnoDB 和 CockroachDB 就是这样无锁实现隔离的。',
  ),
);
const highlightKey = ref('');
const highlightVer = ref(-1);

function beginTxn() {
  txnCounter++;
  const txn: Transaction = {
    id: txnCounter,
    snapshotVer: globalVer.value,
    status: 'active',
    writes: [],
  };
  transactions.value.push(txn);
  message.value = t(
    `T${txn.id} started at snapshot version ${txn.snapshotVer}. It will read data as of v${txn.snapshotVer} — later commits are invisible.`,
    `T${txn.id} 在快照版本 ${txn.snapshotVer} 启动。它将读取 v${txn.snapshotVer} 时的数据 — 之后的提交不可见。`,
  );
  vizHistory.commit(
    {
      globalVer: globalVer.value,
      store: JSON.parse(JSON.stringify(store.value)),
      transactions: JSON.parse(JSON.stringify(transactions.value)),
    },
    `begin T${txn.id}`,
  );
}

const selectedTxn = ref<number | null>(null);
const writeKey = ref('user');
const writeValue = ref('');

function selectTxn(id: number) {
  selectedTxn.value = id;
  const txn = transactions.value.find((t) => t.id === id);
  if (txn) {
    message.value = t(
      `Selected T${id} (snapshot v${txn.snapshotVer}). Use Read/Write below.`,
      `已选择 T${id}（快照 v${txn.snapshotVer}）。使用下方的读/写操作。`,
    );
  }
}

function readKey(key: string) {
  if (selectedTxn.value === null) {
    message.value = t('Select a transaction first.', '请先选择一个事务。');
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = t('Transaction is not active.', '事务未处于活跃状态。');
    return;
  }

  const kv = store.value.find((s) => s.key === key);
  if (!kv) {
    message.value = t(
      `T${txn.id} READ "${key}" -> key not found`,
      `T${txn.id} READ "${key}" -> 键未找到`,
    );
    return;
  }

  const ownWrite = txn.writes.find((w) => w.key === key);
  if (ownWrite) {
    highlightKey.value = key;
    highlightVer.value = -1;
    message.value = t(
      `T${txn.id} READ "${key}" -> ${ownWrite.value} (own uncommitted write)`,
      `T${txn.id} READ "${key}" -> ${ownWrite.value}（自身未提交写入）`,
    );
    safeTimeout(() => {
      highlightKey.value = '';
    }, 600);
    return;
  }

  const visible = kv.versions.filter((v) => v.ver <= txn.snapshotVer).sort((a, b) => b.ver - a.ver);

  if (visible.length === 0) {
    message.value = t(
      `T${txn.id} READ "${key}" -> no visible version at v${txn.snapshotVer}`,
      `T${txn.id} READ "${key}" -> 在 v${txn.snapshotVer} 无可见版本`,
    );
    return;
  }

  const found = visible[0];
  highlightKey.value = key;
  highlightVer.value = found.ver;
  message.value = t(
    `T${txn.id} READ "${key}" -> ${found.value} (version ${found.ver}). Newer versions invisible to snapshot v${txn.snapshotVer}.`,
    `T${txn.id} READ "${key}" -> ${found.value}（版本 ${found.ver}）。更新版本对快照 v${txn.snapshotVer} 不可见。`,
  );
  safeTimeout(() => {
    highlightKey.value = '';
    highlightVer.value = -1;
  }, 800);
}

function writeToKey() {
  if (selectedTxn.value === null) {
    message.value = t('Select a transaction first.', '请先选择一个事务。');
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = t('Transaction is not active.', '事务未处于活跃状态。');
    return;
  }
  const val = writeValue.value.trim();
  if (!val) {
    message.value = t('Enter a value to write.', '请输入要写入的值。');
    return;
  }

  txn.writes.push({ key: writeKey.value, value: val });
  message.value = t(
    `T${txn.id} staged WRITE "${writeKey.value}" = ${val}. Not visible to others until commit.`,
    `T${txn.id} 暂存写入 "${writeKey.value}" = ${val}。提交前对其他事务不可见。`,
  );
  writeValue.value = '';
  vizHistory.commit(
    {
      globalVer: globalVer.value,
      store: JSON.parse(JSON.stringify(store.value)),
      transactions: JSON.parse(JSON.stringify(transactions.value)),
    },
    `T${txn.id} write ${writeKey.value}`,
  );
}

function commitTxn() {
  if (selectedTxn.value === null) {
    message.value = t('Select a transaction first.', '请先选择一个事务。');
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = t('Transaction is not active.', '事务未处于活跃状态。');
    return;
  }

  globalVer.value++;
  const newVer = globalVer.value;

  for (const w of txn.writes) {
    let kv = store.value.find((s) => s.key === w.key);
    if (!kv) {
      kv = { key: w.key, versions: [] };
      store.value.push(kv);
    }
    kv.versions.push({ ver: newVer, value: w.value, txnId: txn.id });
  }

  txn.status = 'committed';
  const writeCount = txn.writes.length;
  message.value = t(
    `T${txn.id} COMMITTED at version ${newVer}. ${writeCount} write(s) now visible to new transactions.`,
    `T${txn.id} 在版本 ${newVer} 提交。${writeCount} 个写入现在对新事务可见。`,
  );
  log(message.value, 'success');
  selectedTxn.value = null;
  vizHistory.commit(
    {
      globalVer: globalVer.value,
      store: JSON.parse(JSON.stringify(store.value)),
      transactions: JSON.parse(JSON.stringify(transactions.value)),
    },
    `commit T${txn.id}`,
  );
}

function abortTxn() {
  if (selectedTxn.value === null) {
    message.value = t('Select a transaction first.', '请先选择一个事务。');
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = t('Transaction is not active.', '事务未处于活跃状态。');
    return;
  }
  txn.status = 'aborted';
  message.value = t(
    `T${txn.id} ABORTED. All staged writes discarded.`,
    `T${txn.id} 已中止。所有暂存写入已丢弃。`,
  );
  log(message.value, 'warning');
  selectedTxn.value = null;
  vizHistory.commit(
    {
      globalVer: globalVer.value,
      store: JSON.parse(JSON.stringify(store.value)),
      transactions: JSON.parse(JSON.stringify(transactions.value)),
    },
    `abort T${txn.id}`,
  );
}

function reset() {
  clearAll();
  globalVer.value = 1;
  txnCounter = 0;
  presetRunning = false;
  store.value = [
    { key: 'user', versions: [{ ver: 1, value: '"alice"', txnId: 0 }] },
    { key: 'balance', versions: [{ ver: 1, value: '100', txnId: 0 }] },
  ];
  transactions.value = [];
  selectedTxn.value = null;
  highlightKey.value = '';
  highlightVer.value = -1;
  message.value = t(
    'Begin a transaction to start. Each gets a snapshot version.',
    '开始一个事务。每个事务获取一个快照版本。',
  );
  clearLog();
  vizHistory.reset();
}

async function presetSnapshotIsolation() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Snapshot isolation: T1 reads, T2 writes and commits, then T1 reads again — T1 still sees the old value. This is PostgreSQL's default REPEATABLE READ level.",
    '快照隔离：T1 读取，T2 写入并提交，然后 T1 再次读取 — T1 仍看到旧值。这是 PostgreSQL 默认的 REPEATABLE READ 级别。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  beginTxn(); // T1
  await delay(400);
  if (!presetRunning || isAborted()) return;
  selectTxn(1);
  readKey('balance');
  await delay(600);
  if (!presetRunning || isAborted()) return;

  beginTxn(); // T2
  await delay(400);
  if (!presetRunning || isAborted()) return;
  selectTxn(2);
  writeKey.value = 'balance';
  writeValue.value = '200';
  writeToKey();
  await delay(400);
  if (!presetRunning || isAborted()) return;
  commitTxn();
  await delay(600);
  if (!presetRunning || isAborted()) return;

  selectTxn(1);
  readKey('balance');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'T1 still reads balance=100 even though T2 committed 200! T1\'s snapshot (v1) is frozen — it never sees T2\'s changes. This prevents "phantom reads" and is how PostgreSQL, CockroachDB, and TiDB implement MVCC.',
    'T1 仍然读到 balance=100，即使 T2 已提交 200！T1 的快照 (v1) 被冻结 — 永远看不到 T2 的变更。这防止了"幻读"，是 PostgreSQL、CockroachDB 和 TiDB 实现 MVCC 的方式。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetWriteConflict() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Write conflict: T1 and T2 both try to update the same key. In real MVCC databases, one would abort due to write-write conflict detection.',
    '写冲突：T1 和 T2 都尝试更新同一个键。在真实 MVCC 数据库中，其中一个会因写-写冲突检测而中止。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  beginTxn(); // T1
  beginTxn(); // T2
  await delay(400);
  if (!presetRunning || isAborted()) return;

  selectTxn(1);
  writeKey.value = 'balance';
  writeValue.value = '300';
  writeToKey();
  await delay(400);
  if (!presetRunning || isAborted()) return;

  selectTxn(2);
  writeKey.value = 'balance';
  writeValue.value = '500';
  writeToKey();
  await delay(400);
  if (!presetRunning || isAborted()) return;

  selectTxn(1);
  commitTxn();
  await delay(400);
  if (!presetRunning || isAborted()) return;

  selectTxn(2);
  abortTxn();
  await delay(400);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'T1 committed, T2 aborted — only one writer wins. PostgreSQL uses "first-updater-wins" rule; CockroachDB uses timestamp ordering. Both prevent lost updates without row-level locks.',
    'T1 提交，T2 中止 — 只有一个写入者胜出。PostgreSQL 使用"先更新者获胜"规则；CockroachDB 使用时间戳排序。两者都无需行级锁即可防止丢失更新。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetVersionChainGrowth() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Version chain growth: multiple commits create multiple versions. Old versions are kept for active snapshots — this is why VACUUM is critical in PostgreSQL.',
    '版本链增长：多次提交创建多个版本。旧版本为活跃快照保留 — 这就是 PostgreSQL 中 VACUUM 至关重要的原因。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  for (let i = 0; i < 3; i++) {
    if (!presetRunning || isAborted()) return;
    beginTxn();
    log(t(`Txn ${txnCounter} started`, `事务 ${txnCounter} 已开始`), 'info');
    await delay(300);
    if (!presetRunning || isAborted()) return;
    selectTxn(txnCounter);
    writeKey.value = 'user';
    writeValue.value = `"user_v${i + 2}"`;
    writeToKey();
    log(t(`write user = "user_v${i + 2}"`, `写入 user = "user_v${i + 2}"`), 'info');
    await delay(300);
    if (!presetRunning || isAborted()) return;
    commitTxn();
    await delay(400);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'The "user" key now has 4 versions. In PostgreSQL, VACUUM removes versions no active transaction needs. In MySQL InnoDB, purge threads clean the undo log. Without cleanup, the version chain grows unbounded — this is "MVCC bloat".',
    '"user" 键现在有 4 个版本。在 PostgreSQL 中，VACUUM 移除没有活跃事务需要的版本。在 MySQL InnoDB 中，purge 线程清理 undo log。不清理的话，版本链无限增长 — 这就是"MVCC 膨胀"。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive MVCC', '交互式 MVCC') }}</div>

    <div class="mv-global">
      {{ t('Global Version:', '全局版本：') }} <strong>v{{ globalVer }}</strong>
    </div>

    <!-- Version chains -->
    <div class="mv-store">
      <div class="mv-store-title">{{ t('Version Chains', '版本链') }}</div>
      <div v-for="kv in store" :key="kv.key" class="mv-chain">
        <div class="mv-chain-key" :class="{ 'mv-chain-key--hl': highlightKey === kv.key }">
          {{ kv.key }}
        </div>
        <div class="mv-chain-arrow">-></div>
        <div class="mv-versions">
          <div
            v-for="v in [...kv.versions].reverse()"
            :key="v.ver"
            class="mv-ver"
            :class="{
              'mv-ver--hl': highlightKey === kv.key && highlightVer === v.ver,
              'mv-ver--latest': v.ver === kv.versions[kv.versions.length - 1]?.ver,
            }"
          >
            <span class="mv-ver-num">v{{ v.ver }}</span>
            <span class="mv-ver-val">{{ v.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Transactions -->
    <div class="mv-txns">
      <div class="mv-txns-title">{{ t('Transactions', '事务') }}</div>
      <div v-if="transactions.length === 0" class="mv-txn-empty">
        {{ t('No transactions yet', '暂无事务') }}
      </div>
      <div
        v-for="txn in transactions"
        :key="txn.id"
        class="mv-txn"
        :class="{
          'mv-txn--active': txn.status === 'active',
          'mv-txn--committed': txn.status === 'committed',
          'mv-txn--aborted': txn.status === 'aborted',
          'mv-txn--selected': selectedTxn === txn.id,
        }"
        @click="txn.status === 'active' ? selectTxn(txn.id) : undefined"
        @keydown.enter.prevent="txn.status === 'active' ? selectTxn(txn.id) : undefined"
        @keydown.space.prevent="txn.status === 'active' ? selectTxn(txn.id) : undefined"
        :role="txn.status === 'active' ? 'button' : undefined"
        :tabindex="txn.status === 'active' ? 0 : undefined"
      >
        <div class="mv-txn-header">
          <span class="mv-txn-id">T{{ txn.id }}</span>
          <span class="mv-txn-snap">snap=v{{ txn.snapshotVer }}</span>
          <span class="mv-txn-status">{{ txn.status }}</span>
        </div>
        <div v-if="txn.writes.length > 0" class="mv-txn-writes">
          <span v-for="(w, i) in txn.writes" :key="i" class="mv-txn-write">
            {{ w.key }}={{ w.value }}
          </span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="beginTxn">
        {{ t('Begin Txn', '开始事务') }}
      </button>
      <button class="viz-btn" :disabled="selectedTxn === null" @click="readKey('user')">
        {{ t('Read user', '读取 user') }}
      </button>
      <button class="viz-btn" :disabled="selectedTxn === null" @click="readKey('balance')">
        {{ t('Read balance', '读取 balance') }}
      </button>
      <button class="viz-btn" :disabled="selectedTxn === null" @click="commitTxn">
        {{ t('Commit', '提交') }}
      </button>
      <button class="viz-btn viz-btn--danger" :disabled="selectedTxn === null" @click="abortTxn">
        {{ t('Abort', '中止') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div v-if="selectedTxn !== null" class="mv-write-row">
      <select v-model="writeKey" class="mv-select">
        <option value="user">user</option>
        <option value="balance">balance</option>
      </select>
      <input
        v-model="writeValue"
        class="mv-input"
        :placeholder="t('value', '值')"
        @keyup.enter="writeToKey"
      />
      <button class="viz-btn viz-btn--primary" @click="writeToKey">{{ t('Write', '写入') }}</button>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetSnapshotIsolation">
        {{ t('Snapshot Isolation', '快照隔离') }}
      </button>
      <button class="viz-btn" @click="presetWriteConflict">
        {{ t('Write Conflict', '写冲突') }}
      </button>
      <button class="viz-btn" @click="presetVersionChainGrowth">
        {{ t('Version Growth', '版本增长') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.mv-global {
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  padding: 0.375rem 0;
}

.mv-store {
  padding: 0.5rem 0;
}

.mv-store-title,
.mv-txns-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-muted);
  margin-bottom: 0.375rem;
}

.mv-chain {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0;
}

.mv-chain-key {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-primary);
  min-width: 4rem;
  transition: all 0.3s;
}

.mv-chain-key--hl {
  color: var(--viz-success);
  transform: scale(1.05);
}

.mv-chain-arrow {
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  font-size: 0.75rem;
}

.mv-versions {
  display: flex;
  gap: 4px;
}

.mv-ver {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  transition: all var(--viz-transition);
  min-width: 48px;
}

.mv-ver--latest {
  border-color: var(--viz-primary);
}

.mv-ver--hl {
  border-color: var(--viz-success);
  background: var(--viz-success);
  color: #fff;
  animation: viz-pulse 0.5s ease;
}

.mv-ver--hl .mv-ver-num,
.mv-ver--hl .mv-ver-val {
  color: #fff;
}

.mv-ver-num {
  font-size: 0.625rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.mv-ver-val {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.mv-txns {
  padding: 0.5rem 0;
}

.mv-txn-empty {
  font-size: 0.75rem;
  color: var(--viz-muted);
  font-style: italic;
}

.mv-txn {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem 0.5rem;
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  margin-bottom: 0.375rem;
  background: var(--vp-c-bg);
  transition: all var(--viz-transition);
}

.mv-txn--active {
  border-color: var(--viz-primary);
  cursor: pointer;
}

.mv-txn--active:hover {
  background: color-mix(in srgb, var(--viz-primary) 6%, var(--vp-c-bg));
}

.mv-txn--selected {
  border-color: var(--viz-warning);
  box-shadow: 0 0 8px color-mix(in srgb, var(--viz-warning) 30%, transparent);
}

.mv-txn--committed {
  border-color: var(--viz-success);
  opacity: 0.6;
}

.mv-txn--aborted {
  border-color: var(--viz-danger);
  opacity: 0.4;
}

.mv-txn-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mv-txn-id {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.mv-txn-snap {
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.mv-txn-status {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: auto;
}

.mv-txn--active .mv-txn-status {
  color: var(--viz-primary);
}

.mv-txn--committed .mv-txn-status {
  color: var(--viz-success);
}

.mv-txn--aborted .mv-txn-status {
  color: var(--viz-danger);
}

.mv-txn-writes {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.mv-txn-write {
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-warning);
  background: color-mix(in srgb, var(--viz-warning) 10%, var(--vp-c-bg));
  padding: 0.125rem 0.375rem;
  border-radius: var(--viz-radius-sm);
}

.mv-write-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0;
  flex-wrap: wrap;
}

.mv-select {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.mv-input {
  width: 80px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.mv-select:focus,
.mv-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

@media (width <= 640px) {
  .mv-ver {
    min-width: 40px;
    padding: 0.2rem 0.375rem;
  }

  .mv-chain-key {
    min-width: 3rem;
    font-size: 0.75rem;
  }
}
</style>
