<script setup lang="ts">
import { ref, computed } from 'vue';

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

const store = ref<KeyVersions[]>([
  { key: 'user', versions: [{ ver: 1, value: '"alice"', txnId: 0 }] },
  { key: 'balance', versions: [{ ver: 1, value: '100', txnId: 0 }] },
]);

const transactions = ref<Transaction[]>([]);
const message = ref('Begin a transaction to start. Each gets a snapshot version.');
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
  message.value = `T${txn.id} started at snapshot version ${txn.snapshotVer}. It will read data as of v${txn.snapshotVer}.`;
}

const activeTxns = computed(() =>
  transactions.value.filter((t) => t.status === 'active')
);

const selectedTxn = ref<number | null>(null);
const writeKey = ref('user');
const writeValue = ref('');

function selectTxn(id: number) {
  selectedTxn.value = id;
  const txn = transactions.value.find((t) => t.id === id);
  if (txn) {
    message.value = `Selected T${id} (snapshot v${txn.snapshotVer}). Use Read/Write below.`;
  }
}

function readKey(key: string) {
  if (selectedTxn.value === null) {
    message.value = 'Select a transaction first.';
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = 'Transaction is not active.';
    return;
  }

  const kv = store.value.find((s) => s.key === key);
  if (!kv) {
    message.value = `T${txn.id} READ "${key}" -> key not found`;
    return;
  }

  const ownWrite = txn.writes.find((w) => w.key === key);
  if (ownWrite) {
    highlightKey.value = key;
    highlightVer.value = -1;
    message.value = `T${txn.id} READ "${key}" -> ${ownWrite.value} (own uncommitted write)`;
    setTimeout(() => { highlightKey.value = ''; }, 600);
    return;
  }

  const visible = kv.versions
    .filter((v) => v.ver <= txn.snapshotVer)
    .sort((a, b) => b.ver - a.ver);

  if (visible.length === 0) {
    message.value = `T${txn.id} READ "${key}" -> no visible version at v${txn.snapshotVer}`;
    return;
  }

  const found = visible[0];
  highlightKey.value = key;
  highlightVer.value = found.ver;
  message.value = `T${txn.id} READ "${key}" -> ${found.value} (version ${found.ver}). Newer versions invisible to snapshot v${txn.snapshotVer}.`;
  setTimeout(() => { highlightKey.value = ''; highlightVer.value = -1; }, 800);
}

function writeToKey() {
  if (selectedTxn.value === null) {
    message.value = 'Select a transaction first.';
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = 'Transaction is not active.';
    return;
  }
  const val = writeValue.value.trim();
  if (!val) {
    message.value = 'Enter a value to write.';
    return;
  }

  txn.writes.push({ key: writeKey.value, value: val });
  message.value = `T${txn.id} staged WRITE "${writeKey.value}" = ${val}. Not visible to others until commit.`;
  writeValue.value = '';
}

function commitTxn() {
  if (selectedTxn.value === null) {
    message.value = 'Select a transaction first.';
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = 'Transaction is not active.';
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
  message.value = `T${txn.id} COMMITTED at version ${newVer}. ${writeCount} write(s) now visible to new transactions.`;
  selectedTxn.value = null;
}

function abortTxn() {
  if (selectedTxn.value === null) {
    message.value = 'Select a transaction first.';
    return;
  }
  const txn = transactions.value.find((t) => t.id === selectedTxn.value);
  if (!txn || txn.status !== 'active') {
    message.value = 'Transaction is not active.';
    return;
  }
  txn.status = 'aborted';
  message.value = `T${txn.id} ABORTED. All staged writes discarded.`;
  selectedTxn.value = null;
}

function reset() {
  globalVer.value = 1;
  txnCounter = 0;
  store.value = [
    { key: 'user', versions: [{ ver: 1, value: '"alice"', txnId: 0 }] },
    { key: 'balance', versions: [{ ver: 1, value: '100', txnId: 0 }] },
  ];
  transactions.value = [];
  selectedTxn.value = null;
  highlightKey.value = '';
  highlightVer.value = -1;
  message.value = 'Begin a transaction to start. Each gets a snapshot version.';
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive MVCC</div>

    <div class="mv-global">Global Version: <strong>v{{ globalVer }}</strong></div>

    <!-- Version chains -->
    <div class="mv-store">
      <div class="mv-store-title">Version Chains</div>
      <div v-for="kv in store" :key="kv.key" class="mv-chain">
        <div class="mv-chain-key" :class="{ 'mv-chain-key--hl': highlightKey === kv.key }">{{ kv.key }}</div>
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
      <div class="mv-txns-title">Transactions</div>
      <div v-if="transactions.length === 0" class="mv-txn-empty">No transactions yet</div>
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
      <button class="viz-btn viz-btn--primary" @click="beginTxn">Begin Txn</button>
      <button class="viz-btn" :disabled="selectedTxn === null" @click="readKey('user')">Read user</button>
      <button class="viz-btn" :disabled="selectedTxn === null" @click="readKey('balance')">Read balance</button>
      <button class="viz-btn" :disabled="selectedTxn === null" @click="commitTxn">Commit</button>
      <button class="viz-btn viz-btn--danger" :disabled="selectedTxn === null" @click="abortTxn">Abort</button>
      <button class="viz-btn viz-btn--danger" @click="reset">Reset</button>
    </div>

    <div v-if="selectedTxn !== null" class="mv-write-row">
      <select v-model="writeKey" class="mv-select">
        <option value="user">user</option>
        <option value="balance">balance</option>
      </select>
      <input v-model="writeValue" class="mv-input" placeholder="value" @keyup.enter="writeToKey" />
      <button class="viz-btn viz-btn--primary" @click="writeToKey">Write</button>
    </div>

    <div class="viz-status">{{ message }}</div>
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
  border-radius: 4px;
  background: var(--vp-c-bg);
  transition: all 0.3s ease;
  min-width: 48px;
}

.mv-ver--latest {
  border-color: var(--viz-primary);
}

.mv-ver--hl {
  border-color: var(--viz-success);
  background: var(--viz-success);
  color: #fff;
  animation: mv-flash 0.5s ease;
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
  border-radius: 6px;
  margin-bottom: 0.375rem;
  background: var(--vp-c-bg);
  transition: all 0.2s ease;
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

.mv-txn--active .mv-txn-status { color: var(--viz-primary); }
.mv-txn--committed .mv-txn-status { color: var(--viz-success); }
.mv-txn--aborted .mv-txn-status { color: var(--viz-danger); }

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
  border-radius: 3px;
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
  border-radius: 6px;
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.mv-input {
  width: 80px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
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

@keyframes mv-flash {
  0% { transform: scale(1); }
  40% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@media (max-width: 640px) {
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
