<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

let presetRunning = false;

interface Entry {
  key: string;
  value: string;
  status: 'active' | 'tombstoned' | 'free';
  id: number;
}

let nextId = 0;
const CAPACITY = 12;

const store = ref<Entry[]>(createInitial());
const message = ref(
  t(
    'A key-value store using tombstone deletion. Write, delete, read, and compact.',
    '使用墓碑删除的键值存储。写入、删除、读取和压缩。',
  ),
);
const writeKey = ref('');
const writeValue = ref('');
const readKey = ref('');
const readResult = ref<{ found: boolean; value?: string; tombstoned?: boolean } | null>(null);
const flashId = ref(-1);
const compacting = ref(false);

const vizHistory = useVizHistory<Entry[]>([], {
  getMessage: () => message.value,
  onRestore(snapshot, msg) {
    presetRunning = false;
    clearAll();
    compacting.value = false;
    store.value = snapshot.map((e) => ({ ...e }));
    flashId.value = -1;
    if (msg !== undefined) message.value = msg;
  },
});

function createInitial(): Entry[] {
  nextId = 0;
  const data: [string, string][] = [
    ['user:1', 'Alice'],
    ['user:2', 'Bob'],
    ['user:3', 'Carol'],
    ['cfg:theme', 'dark'],
  ];
  const entries: Entry[] = data.map(([k, v]) => ({
    key: k,
    value: v,
    status: 'active' as const,
    id: ++nextId,
  }));
  while (entries.length < CAPACITY) {
    entries.push({ key: '', value: '', status: 'free' as const, id: ++nextId });
  }
  return entries;
}

const presetWrites: [string, string][] = [
  ['user:4', 'Dave'],
  ['cfg:lang', 'en'],
  ['log:last', '2024-01'],
  ['user:5', 'Eve'],
  ['cfg:tz', 'UTC'],
];
let presetIdx = 0;

const stats = computed(() => {
  const active = store.value.filter((e) => e.status === 'active').length;
  const tombstoned = store.value.filter((e) => e.status === 'tombstoned').length;
  const free = store.value.filter((e) => e.status === 'free').length;
  const total = store.value.length;
  return { active, tombstoned, free, total };
});

const usagePercent = computed(() => {
  const used = stats.value.active + stats.value.tombstoned;
  return Math.round((used / stats.value.total) * 100);
});

function doWrite() {
  let key = writeKey.value.trim();
  let value = writeValue.value.trim();

  if (!key || !value) {
    if (presetIdx < presetWrites.length) {
      [key, value] = presetWrites[presetIdx++];
    } else {
      message.value = t('Enter a key and value to write.', '请输入键和值以写入。');
      return;
    }
  }

  // Check if key already exists (overwrite)
  const existing = store.value.find((e) => e.key === key && e.status === 'active');
  if (existing) {
    existing.value = value;
    flashId.value = existing.id;
    message.value = t(
      `Updated "${key}" = "${value}" (overwrite).`,
      `已更新 "${key}" = "${value}"（覆写）。`,
    );
    log(message.value, 'info');
    writeKey.value = '';
    writeValue.value = '';
    safeTimeout(() => {
      flashId.value = -1;
    }, 600);
    vizHistory.commit(
      store.value.map((e) => ({ ...e })),
      `write ${key}`,
    );
    return;
  }

  // Find first free slot
  const freeSlot = store.value.find((e) => e.status === 'free');
  if (!freeSlot) {
    message.value = t(
      'Store is full! Compact to reclaim tombstoned slots.',
      '存储已满！压缩以回收已标记删除的槽位。',
    );
    return;
  }

  freeSlot.key = key;
  freeSlot.value = value;
  freeSlot.status = 'active';
  flashId.value = freeSlot.id;
  message.value = t(
    `Wrote "${key}" = "${value}". ${stats.value.free - 1} free slot(s) remaining.`,
    `已写入 "${key}" = "${value}"。剩余 ${stats.value.free - 1} 个空闲槽位。`,
  );
  log(message.value, 'success');
  writeKey.value = '';
  writeValue.value = '';
  safeTimeout(() => {
    flashId.value = -1;
  }, 600);
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    `write ${key}`,
  );
}

function doDelete(entry: Entry) {
  if (entry.status !== 'active') return;
  entry.status = 'tombstoned';
  flashId.value = entry.id;
  message.value = t(
    `Tombstoned "${entry.key}". Data remains but is marked deleted. Compact to reclaim.`,
    `已标记删除 "${entry.key}"。数据仍在但已标记为删除。压缩以回收。`,
  );
  log(message.value, 'warning');
  if (readResult.value) {
    readResult.value = null;
  }
  safeTimeout(() => {
    flashId.value = -1;
  }, 600);
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    `delete ${entry.key}`,
  );
}

function doRead() {
  const key = readKey.value.trim();
  if (!key) {
    message.value = t('Enter a key to read.', '请输入要读取的键。');
    return;
  }

  const entry = store.value.find(
    (e) => e.key === key && (e.status === 'active' || e.status === 'tombstoned'),
  );
  if (!entry) {
    readResult.value = { found: false };
    message.value = t(
      `Read "${key}": NOT FOUND (key does not exist).`,
      `读取 "${key}"：未找到（键不存在）。`,
    );
    log(message.value, 'error');
  } else if (entry.status === 'tombstoned') {
    readResult.value = { found: false, tombstoned: true };
    flashId.value = entry.id;
    message.value = t(
      `Read "${key}": NOT FOUND (tombstoned). Data exists but is logically deleted.`,
      `读取 "${key}"：未找到（已标记删除）。数据存在但已逻辑删除。`,
    );
    log(message.value, 'warning');
    safeTimeout(() => {
      flashId.value = -1;
    }, 600);
  } else {
    readResult.value = { found: true, value: entry.value };
    flashId.value = entry.id;
    message.value = t(
      `Read "${key}": FOUND -> "${entry.value}"`,
      `读取 "${key}"：找到 -> "${entry.value}"`,
    );
    log(message.value, 'success');
    safeTimeout(() => {
      flashId.value = -1;
    }, 600);
  }
  readKey.value = '';
}

async function doCompact() {
  if (compacting.value) return;
  compacting.value = true;

  const tombstoned = store.value.filter((e) => e.status === 'tombstoned');
  if (tombstoned.length === 0) {
    message.value = t(
      'Nothing to compact. No tombstoned entries.',
      '无需压缩。没有已标记删除的条目。',
    );
    compacting.value = false;
    return;
  }

  message.value = t(
    `Compacting... removing ${tombstoned.length} tombstoned entry(s).`,
    `压缩中...移除 ${tombstoned.length} 个已标记删除的条目。`,
  );

  // Animate each tombstoned entry removal
  for (const entry of tombstoned) {
    flashId.value = entry.id;
    await delay(300);
    if (isAborted()) return;
    entry.key = '';
    entry.value = '';
    entry.status = 'free';
  }

  // Shift active entries to fill gaps
  const active = store.value.filter((e) => e.status === 'active');
  const freeCount = CAPACITY - active.length;
  const newStore: Entry[] = active.map((e) => ({ ...e }));
  for (let i = 0; i < freeCount; i++) {
    newStore.push({ key: '', value: '', status: 'free' as const, id: ++nextId });
  }
  store.value = newStore;

  flashId.value = -1;
  compacting.value = false;
  message.value = t(
    `Compaction done. Reclaimed ${tombstoned.length} slot(s). Active entries shifted left.`,
    `压缩完成。回收了 ${tombstoned.length} 个槽位。活跃条目已左移。`,
  );
  log(message.value, 'highlight');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'compact',
  );
}

function reset() {
  clearAll();
  presetRunning = false;
  store.value = createInitial();
  presetIdx = 0;
  writeKey.value = '';
  writeValue.value = '';
  readKey.value = '';
  readResult.value = null;
  flashId.value = -1;
  compacting.value = false;
  message.value = t(
    'Store reset. Write, delete, read, and compact to explore tombstone deletion.',
    '存储已重置。写入、删除、读取和压缩以探索墓碑删除。',
  );
  clearLog();
  vizHistory.reset();
}

/* ---------- Preset scenarios ---------- */

function programmaticWrite(key: string, value: string) {
  const existing = store.value.find((e) => e.key === key && e.status === 'active');
  if (existing) {
    existing.value = value;
    flashId.value = existing.id;
    safeTimeout(() => {
      flashId.value = -1;
    }, 600);
    return;
  }
  const freeSlot = store.value.find((e) => e.status === 'free');
  if (!freeSlot) return;
  freeSlot.key = key;
  freeSlot.value = value;
  freeSlot.status = 'active';
  flashId.value = freeSlot.id;
  safeTimeout(() => {
    flashId.value = -1;
  }, 600);
}

function programmaticDelete(key: string) {
  const entry = store.value.find((e) => e.key === key && e.status === 'active');
  if (!entry) return;
  entry.status = 'tombstoned';
  flashId.value = entry.id;
  safeTimeout(() => {
    flashId.value = -1;
  }, 600);
}

function programmaticRead(key: string) {
  const entry = store.value.find(
    (e) => e.key === key && (e.status === 'active' || e.status === 'tombstoned'),
  );
  if (!entry) {
    readResult.value = { found: false };
  } else if (entry.status === 'tombstoned') {
    readResult.value = { found: false, tombstoned: true };
    flashId.value = entry.id;
    safeTimeout(() => {
      flashId.value = -1;
    }, 600);
  } else {
    readResult.value = { found: true, value: entry.value };
    flashId.value = entry.id;
    safeTimeout(() => {
      flashId.value = -1;
    }, 600);
  }
}

async function presetWriteDeleteCompact() {
  if (presetRunning) return;
  reset();
  presetRunning = true;

  message.value = t(
    'Write-delete-compact cycle: the core lifecycle of tombstone-based storage. Cassandra writes tombstones on DELETE, then removes them during compaction after gc_grace_seconds (default 10 days).',
    '写-删-压缩循环：基于墓碑存储的核心生命周期。Cassandra 在 DELETE 时写入墓碑，然后在 gc_grace_seconds（默认 10 天）后的压缩中移除它们。',
  );
  log(message.value, 'highlight');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'preset:intro',
  );

  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Write 3 entries
  programmaticWrite('order:1', 'pending');
  message.value = t('Writing order:1 = "pending"...', '写入 order:1 = "pending"...');
  log(message.value, 'info');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'write order:1',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  programmaticWrite('order:2', 'shipped');
  message.value = t('Writing order:2 = "shipped"...', '写入 order:2 = "shipped"...');
  log(message.value, 'info');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'write order:2',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  programmaticWrite('order:3', 'delivered');
  message.value = t('Writing order:3 = "delivered"...', '写入 order:3 = "delivered"...');
  log(message.value, 'info');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'write order:3',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Delete 2
  programmaticDelete('order:1');
  message.value = t(
    'Deleting order:1 — tombstone placed. Data still occupies the slot.',
    '删除 order:1 — 放置墓碑。数据仍占用槽位。',
  );
  log(message.value, 'warning');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'delete order:1',
  );
  await delay(700);
  if (!presetRunning || isAborted()) return;

  programmaticDelete('order:2');
  message.value = t(
    'Deleting order:2 — another tombstone. 2 slots wasted until compaction.',
    '删除 order:2 — 又一个墓碑。在压缩之前浪费 2 个槽位。',
  );
  log(message.value, 'warning');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'delete order:2',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Compact
  message.value = t(
    'Starting compaction to reclaim tombstoned slots...',
    '开始压缩以回收墓碑槽位...',
  );
  log(message.value, 'highlight');
  vizHistory.commit(
    store.value.map((e) => ({ ...e })),
    'compact:start',
  );
  await delay(400);
  if (!presetRunning || isAborted()) return;
  await doCompact();
  if (!presetRunning || isAborted()) return;

  await delay(400);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'Compaction reclaimed 2 slots. In LSM trees (RocksDB, LevelDB), compaction merges tombstones with live data — without it, read amplification grows because every read must check if a tombstone shadows the value.',
    '压缩回收了 2 个槽位。在 LSM 树（RocksDB、LevelDB）中，压缩将墓碑与活跃数据合并——如果没有压缩，读放大会增长，因为每次读取都必须检查墓碑是否遮蔽了值。',
  );
  presetRunning = false;
}

async function presetSpaceAmplification() {
  if (presetRunning) return;
  reset();
  presetRunning = true;

  message.value = t(
    'Space amplification: filling most slots, then deleting all but 2 to show wasted space. In RocksDB, space_amp = total_size / live_data_size.',
    '空间放大：填满大部分槽位，然后删除除 2 个外的所有条目以展示浪费的空间。在 RocksDB 中，space_amp = total_size / live_data_size。',
  );

  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Fill slots — we already have 4 from createInitial, add more
  const fills: [string, string][] = [
    ['item:1', 'alpha'],
    ['item:2', 'beta'],
    ['item:3', 'gamma'],
    ['item:4', 'delta'],
    ['item:5', 'epsilon'],
    ['item:6', 'zeta'],
    ['item:7', 'eta'],
    ['item:8', 'theta'],
  ];

  for (const [k, v] of fills) {
    programmaticWrite(k, v);
    await delay(250);
    if (!presetRunning || isAborted()) return;
  }

  message.value = t(
    'Store is full with 12 entries. Now deleting 10 of them...',
    '存储已满，共 12 个条目。现在删除其中 10 个...',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Delete all except user:1 and user:2 (keep 2 alive)
  const toDelete = store.value.filter(
    (e) => e.status === 'active' && e.key !== 'user:1' && e.key !== 'user:2',
  );
  for (const entry of toDelete) {
    programmaticDelete(entry.key);
    await delay(200);
    if (!presetRunning || isAborted()) return;
  }

  await delay(600);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'Space amplification: 10 tombstoned entries waste 83% of capacity. In RocksDB, space_amp = total_size / live_data_size. SSDs use TRIM to reclaim tombstoned blocks. Without compaction, storage cost grows linearly with total writes, not live data.',
    '空间放大：10 个墓碑条目浪费了 83% 的容量。在 RocksDB 中，space_amp = total_size / live_data_size。SSD 使用 TRIM 回收墓碑块。如果没有压缩，存储成本随总写入量线性增长，而非活跃数据量。',
  );
  presetRunning = false;
}

async function presetReadThroughTombstone() {
  if (presetRunning) return;
  reset();
  presetRunning = true;

  message.value = t(
    'Read-through-tombstone: demonstrating how deleted keys are still found during scan but return NOT FOUND.',
    '读穿墓碑：演示已删除的键在扫描时仍被找到但返回"未找到"。',
  );

  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Write a key
  programmaticWrite('session:42', 'active');
  message.value = t('Writing session:42 = "active"...', '写入 session:42 = "active"...');
  await delay(700);
  if (!presetRunning || isAborted()) return;

  // Read it — should be found
  programmaticRead('session:42');
  message.value = t(
    'Reading session:42 — FOUND: "active". The key exists and is live.',
    '读取 session:42 — 找到："active"。键存在且为活跃状态。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Delete it
  readResult.value = null;
  programmaticDelete('session:42');
  message.value = t(
    'Deleting session:42 — tombstone placed. The slot is still occupied.',
    '删除 session:42 — 放置墓碑。槽位仍被占用。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  // Read it again — tombstoned
  programmaticRead('session:42');
  message.value = t(
    'Reading session:42 — NOT FOUND (tombstoned). The entry is found in storage but the tombstone marks it deleted.',
    '读取 session:42 — 未找到（已标记删除）。条目在存储中被找到但墓碑将其标记为已删除。',
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'Read-through-tombstone: the deleted key still occupies space and is found during scan — but returns NOT FOUND. In distributed systems (Dynamo, Cassandra), tombstones must propagate to all replicas before removal, or deleted data reappears — the "zombie resurrection" problem.',
    '读穿墓碑：已删除的键仍占用空间，在扫描时被找到——但返回"未找到"。在分布式系统（Dynamo、Cassandra）中，墓碑必须传播到所有副本后才能移除，否则已删除的数据会重新出现——即"僵尸复活"问题。',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Tombstone Deletion', '交互式 Tombstone 删除') }}</div>

    <!-- Space usage bar -->
    <div class="ts-usage">
      <div class="ts-usage-bar">
        <div
          class="ts-usage-fill ts-usage-fill--active"
          :style="{ width: (stats.active / stats.total) * 100 + '%' }"
        ></div>
        <div
          class="ts-usage-fill ts-usage-fill--tombstoned"
          :style="{ width: (stats.tombstoned / stats.total) * 100 + '%' }"
        ></div>
      </div>
      <div class="ts-usage-stats">
        <span class="ts-stat">
          <span class="ts-stat-dot ts-stat-dot--active"></span>
          {{ t('Active:', '活跃：') }} {{ stats.active }}
        </span>
        <span class="ts-stat">
          <span class="ts-stat-dot ts-stat-dot--tombstoned"></span>
          {{ t('Tombstoned:', '已标记删除：') }} {{ stats.tombstoned }}
        </span>
        <span class="ts-stat">
          <span class="ts-stat-dot ts-stat-dot--free"></span>
          {{ t('Free:', '空闲：') }} {{ stats.free }}
        </span>
        <span class="ts-stat ts-stat--pct">{{ usagePercent }}% {{ t('used', '已用') }}</span>
      </div>
    </div>

    <!-- Store grid -->
    <div class="ts-grid">
      <div
        v-for="entry in store"
        :key="entry.id"
        class="ts-cell"
        :class="{
          'ts-cell--active': entry.status === 'active',
          'ts-cell--tombstoned': entry.status === 'tombstoned',
          'ts-cell--free': entry.status === 'free',
          'ts-cell--flash': flashId === entry.id,
        }"
      >
        <template v-if="entry.status === 'free'">
          <div class="ts-cell-empty">{{ t('FREE', '空闲') }}</div>
        </template>
        <template v-else>
          <div class="ts-cell-header">
            <span class="ts-cell-key">{{ entry.key }}</span>
            <button
              v-if="entry.status === 'active'"
              class="ts-delete-btn"
              :title="t('Delete (tombstone)', '删除（墓碑标记）')"
              @click="doDelete(entry)"
            >
              x
            </button>
          </div>
          <div class="ts-cell-value">
            <template v-if="entry.status === 'tombstoned'">
              <span class="ts-tombstone-icon">&#x2620;</span>
            </template>
            <template v-else>
              {{ entry.value }}
            </template>
          </div>
          <div class="ts-cell-status">
            <span v-if="entry.status === 'active'" class="ts-badge ts-badge--active">{{
              t('active', '活跃')
            }}</span>
            <span v-else class="ts-badge ts-badge--tombstoned">{{
              t('tombstoned', '已标记删除')
            }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Controls row -->
    <div class="ts-controls-grid">
      <!-- Write -->
      <div class="ts-control-panel">
        <div class="ts-control-label">{{ t('Write', '写入') }}</div>
        <div class="ts-control-row">
          <input
            v-model="writeKey"
            class="ts-input"
            :placeholder="t('key', '键')"
            maxlength="12"
            @keyup.enter="doWrite"
          />
          <input
            v-model="writeValue"
            class="ts-input"
            :placeholder="t('value', '值')"
            maxlength="12"
            @keyup.enter="doWrite"
          />
          <button class="viz-btn viz-btn--primary ts-btn-sm" @click="doWrite">
            {{ t('Write', '写入') }}
          </button>
        </div>
      </div>

      <!-- Read -->
      <div class="ts-control-panel">
        <div class="ts-control-label">{{ t('Read', '读取') }}</div>
        <div class="ts-control-row">
          <input
            v-model="readKey"
            class="ts-input ts-input--wide"
            :placeholder="t('key to read', '要读取的键')"
            maxlength="12"
            @keyup.enter="doRead"
          />
          <button class="viz-btn ts-btn-sm" @click="doRead">{{ t('Read', '读取') }}</button>
        </div>
        <!-- Read result -->
        <div
          v-if="readResult"
          class="ts-read-result"
          :class="{
            'ts-read-result--found': readResult.found,
            'ts-read-result--miss': !readResult.found,
          }"
        >
          <template v-if="readResult.found">
            {{ t('FOUND:', '找到：') }} "{{ readResult.value }}"
          </template>
          <template v-else-if="readResult.tombstoned">
            {{ t('NOT FOUND (tombstoned)', '未找到（已标记删除）') }}
          </template>
          <template v-else>
            {{ t('NOT FOUND', '未找到') }}
          </template>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button
        class="viz-btn viz-btn--primary"
        :disabled="compacting || stats.tombstoned === 0"
        @click="doCompact"
      >
        {{
          compacting
            ? t('Compacting...', '压缩中...')
            : t(`Compact (reclaim ${stats.tombstoned})`, `压缩（回收 ${stats.tombstoned}）`)
        }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetWriteDeleteCompact">
        {{ t('Write-Delete-Compact', '写删压缩') }}
      </button>
      <button class="viz-btn" @click="presetSpaceAmplification">
        {{ t('Space Bloat', '空间膨胀') }}
      </button>
      <button class="viz-btn" @click="presetReadThroughTombstone">
        {{ t('Read Tombstone', '读取墓碑') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
/* Usage bar */
.ts-usage {
  margin: 0.5rem 0;
}

.ts-usage-bar {
  display: flex;
  height: 8px;
  border-radius: var(--viz-radius-sm);
  background: color-mix(in srgb, var(--viz-border) 50%, var(--vp-c-bg));
  overflow: hidden;
}

.ts-usage-fill {
  transition: width var(--viz-transition);
}

.ts-usage-fill--active {
  background: var(--viz-success);
}

.ts-usage-fill--tombstoned {
  background: var(--viz-danger);
  opacity: 0.6;
}

.ts-usage-stats {
  display: flex;
  gap: 1rem;
  margin-top: 0.375rem;
  flex-wrap: wrap;
}

.ts-stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.ts-stat--pct {
  margin-left: auto;
  color: var(--viz-muted);
}

.ts-stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.ts-stat-dot--active {
  background: var(--viz-success);
}

.ts-stat-dot--tombstoned {
  background: var(--viz-danger);
  opacity: 0.6;
}

.ts-stat-dot--free {
  background: var(--viz-border);
}

/* Store grid */
.ts-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin: 0.5rem 0;
}

.ts-cell {
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  padding: 0.375rem;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  transition: all var(--viz-transition);
  background: var(--vp-c-bg);
}

.ts-cell--active {
  border-color: color-mix(in srgb, var(--viz-success) 50%, var(--viz-border));
}

.ts-cell--tombstoned {
  border-color: var(--viz-danger);
  border-style: dashed;
  opacity: 0.6;
  background: color-mix(in srgb, var(--viz-danger) 5%, var(--vp-c-bg));
}

.ts-cell--free {
  border-style: dashed;
  opacity: 0.4;
}

.ts-cell--flash {
  animation: viz-pulse 0.5s ease;
}

.ts-cell-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  font-size: 0.625rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.ts-cell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
}

.ts-cell-key {
  font-size: 0.625rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-delete-btn {
  background: none;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  width: 18px;
  height: 18px;
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--viz-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}

.ts-delete-btn:hover {
  border-color: var(--viz-danger);
  color: var(--viz-danger);
  background: color-mix(in srgb, var(--viz-danger) 10%, transparent);
}

.ts-cell-value {
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  padding: 0.125rem 0;
  flex: 1;
  display: flex;
  align-items: center;
}

.ts-tombstone-icon {
  font-size: 1.125rem;
  opacity: 0.7;
}

.ts-cell-status {
  margin-top: auto;
}

.ts-badge {
  display: inline-block;
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.0625rem 0.25rem;
  border-radius: 2px;
}

.ts-badge--active {
  color: var(--viz-success);
  background: color-mix(in srgb, var(--viz-success) 12%, transparent);
}

.ts-badge--tombstoned {
  color: var(--viz-danger);
  background: color-mix(in srgb, var(--viz-danger) 12%, transparent);
}

/* Controls */
.ts-controls-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0.5rem 0;
}

.ts-control-panel {
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  padding: 0.5rem;
}

.ts-control-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-muted);
  margin-bottom: 0.375rem;
}

.ts-control-row {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.ts-input {
  width: 80px;
  padding: 0.3125rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.ts-input--wide {
  flex: 1;
  min-width: 80px;
}

.ts-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

.ts-btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
}

.ts-read-result {
  margin-top: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--viz-radius-sm);
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  animation: ts-fade-in 0.3s ease;
}

.ts-read-result--found {
  color: var(--viz-success);
  background: color-mix(in srgb, var(--viz-success) 8%, var(--vp-c-bg));
  border: 1px solid color-mix(in srgb, var(--viz-success) 30%, var(--viz-border));
}

.ts-read-result--miss {
  color: var(--viz-danger);
  background: color-mix(in srgb, var(--viz-danger) 8%, var(--vp-c-bg));
  border: 1px solid color-mix(in srgb, var(--viz-danger) 30%, var(--viz-border));
}

@keyframes ts-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (width <= 640px) {
  .ts-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .ts-controls-grid {
    grid-template-columns: 1fr;
  }

  .ts-cell-key {
    font-size: 0.5625rem;
  }

  .ts-cell-value {
    font-size: 0.6875rem;
  }

  .ts-input {
    width: 60px;
    font-size: 0.6875rem;
  }
}
</style>
