<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, safeTimeout, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const CX = 150, CY = 150, R = 110;

interface Node { id: string; hash: number; color: string }
interface Key { id: string; hash: number }

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const nodes = ref<Node[]>([
  { id: 'A', hash: 0.0, color: COLORS[0] },
  { id: 'B', hash: 0.33, color: COLORS[1] },
  { id: 'C', hash: 0.66, color: COLORS[2] },
]);

const keys = ref<Key[]>([]);
const message = ref(t(
  'Add keys to see which node owns them — or pick a scenario to see minimal redistribution',
  '添加键来查看哪个节点拥有它们 — 或选择场景观看最小重分布'
));
const animHash = ref(-1);
let nextKeyId = 1;
let presetRunning = false;

interface ConsistentHashSnapshot { nodes: {id: string; hash: number; color: string}[]; keys: {id: string; hash: number}[] }
const history = useVizHistory<ConsistentHashSnapshot>(
  { nodes: JSON.parse(JSON.stringify(nodes.value)), keys: [] },
  { getMessage: () => message.value,
 onRestore: (s, msg) => { presetRunning = false; nodes.value = s.nodes; keys.value = s.keys; animHash.value = -1; if (msg !== undefined) message.value = msg; } },
);
function commitSnapshot(label: string) {
  history.commit({ nodes: JSON.parse(JSON.stringify(nodes.value)), keys: JSON.parse(JSON.stringify(keys.value)) }, label);
}

function hashPos(h: number) {
  const angle = h * 2 * Math.PI - Math.PI / 2;
  return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
}

function simpleHash(s: string): number {
  // FNV-1a inspired hash — much better distribution than naive polynomial
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function findOwner(keyHash: number): Node | null {
  if (nodes.value.length === 0) return null;
  const sorted = [...nodes.value].sort((a, b) => a.hash - b.hash);
  for (const n of sorted) {
    if (keyHash <= n.hash) return n;
  }
  return sorted[0];
}

const keyOwnership = computed(() =>
  keys.value.map(k => ({
    ...k,
    owner: findOwner(k.hash),
    pos: hashPos(k.hash),
  }))
);

const nodePositions = computed(() =>
  nodes.value.map(n => ({
    ...n,
    pos: hashPos(n.hash),
  }))
);

function addKey() {
  const id = `k${nextKeyId++}`;
  const h = simpleHash(id);
  keys.value.push({ id, hash: h });
  const owner = findOwner(h);
  animHash.value = h;
  message.value = t(
    `Key "${id}" hashes to ${h.toFixed(2)} → walks clockwise to node ${owner?.id ?? 'none'}. Lookup is O(log N) via binary search on the sorted node ring.`,
    `键 "${id}" 哈希到 ${h.toFixed(2)} → 顺时针走到节点 ${owner?.id ?? '无'}。通过排序节点列表，顺时针查找是 O(log N)。`
  );
  log(message.value, 'info');
  safeTimeout(() => { animHash.value = -1; }, 500);
  commitSnapshot(`addKey ${id}`);
}

function addNode() {
  if (nodes.value.length >= 6) { message.value = t('Max 6 nodes', '最多 6 个节点'); return; }
  const id = String.fromCharCode(65 + nodes.value.length);
  const h = simpleHash(id + Date.now());
  const oldOwnership = keys.value.map(k => findOwner(k.hash)?.id);
  nodes.value.push({ id, hash: h, color: COLORS[nodes.value.length] });
  const newOwnership = keys.value.map(k => findOwner(k.hash)?.id);
  const moved = oldOwnership.filter((old, i) => old !== newOwnership[i]).length;
  message.value = t(
    `Added node ${id} at ${h.toFixed(2)}. Only ${moved}/${keys.value.length} keys moved — this is consistent hashing's key property: O(K/N) redistribution.`,
    `已添加节点 ${id}，位置 ${h.toFixed(2)}。仅 ${moved}/${keys.value.length} 个键迁移 — 这是一致性哈希的核心特性：O(K/N) 重分布。`
  );
  log(message.value, 'success');
  commitSnapshot(`addNode ${id}`);
}

function removeNode() {
  if (nodes.value.length <= 1) { message.value = t('Need at least 1 node', '至少需要 1 个节点'); return; }
  const removed = nodes.value[nodes.value.length - 1];
  const movedKeys = keys.value.filter(k => findOwner(k.hash)?.id === removed.id);
  nodes.value.pop();
  message.value = t(
    `Removed node ${removed.id}. Only ${movedKeys.length} keys redistributed to neighbors — other keys are untouched. Compare with modular hashing where ALL keys would move.`,
    `已删除节点 ${removed.id}。仅 ${movedKeys.length} 个键重分布到邻居节点 — 其他键不受影响。对比取模哈希，所有键都会移动。`
  );
  log(message.value, 'warning');
  commitSnapshot(`removeNode ${removed.id}`);
}

function reset() {
  clearAll();
  nodes.value = [
    { id: 'A', hash: 0.0, color: COLORS[0] },
    { id: 'B', hash: 0.33, color: COLORS[1] },
    { id: 'C', hash: 0.66, color: COLORS[2] },
  ];
  keys.value = [];
  nextKeyId = 1;
  presetRunning = false;
  message.value = t('Reset! Add keys to see consistent hashing in action.', '已重置！添加键来查看一致性哈希的效果。');
  clearLog();
  history.reset();
}

async function presetScaleOut() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  for (let i = 0; i < 8; i++) {
    if (!presetRunning || isAborted()) return;
    addKey();
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    '8 keys distributed across 3 nodes. Now adding a 4th node — watch how few keys move...',
    '8 个键分布在 3 个节点上。现在添加第 4 个节点 — 观察有多少键移动...'
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  addNode();
  await delay(1500);
  if (!presetRunning || isAborted()) return;
  addNode();
  message.value = t(
    'Scale-out complete. Amazon DynamoDB and Cassandra use this to add nodes without reshuffling the entire cluster.',
    '扩容完成。Amazon DynamoDB 和 Cassandra 使用此方法添加节点而无需重新分布整个集群。'
  );
  log(message.value, 'success');
  log(t(
    'Adding nodes redistributes only O(K/N) keys — the rest stay on their current nodes.',
    '添加节点只重新分配 O(K/N) 个键 — 其余保持在当前节点。'
  ), 'highlight');
  presetRunning = false;
}

async function presetNodeFailure() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  addNode();
  await delay(300);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 10; i++) {
    if (!presetRunning || isAborted()) return;
    addKey();
    await delay(300);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    '10 keys across 4 nodes. Simulating node failure — removing the last node...',
    '10 个键分布在 4 个节点上。模拟节点故障 — 移除最后一个节点...'
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  removeNode();
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Node failure handled gracefully. Only the failed node\'s keys moved to its clockwise neighbor — the rest of the cluster is unaffected.',
    '节点故障被优雅处理。只有故障节点的键移动到其顺时针邻居 — 集群其余部分不受影响。'
  );
  log(message.value, 'success');
  log(t(
    'Node failure only affects keys owned by the failed node — the rest of the cluster is unaffected.',
    '节点故障只影响故障节点拥有的键 — 集群其余部分不受影响。'
  ), 'highlight');
  presetRunning = false;
}

async function presetHotSpot() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  for (let i = 0; i < 12; i++) {
    if (!presetRunning || isAborted()) return;
    addKey();
    await delay(300);
    if (!presetRunning || isAborted()) return;
  }
  const distribution = nodes.value.map(n => ({
    id: n.id,
    count: keys.value.filter(k => findOwner(k.hash)?.id === n.id).length,
  }));
  const max = Math.max(...distribution.map(d => d.count));
  const min = Math.min(...distribution.map(d => d.count));
  message.value = t(
    `Distribution: ${distribution.map(d => `${d.id}=${d.count}`).join(', ')}. Skew: ${max - min}. Virtual nodes (vnodes) solve this — each physical node gets 100+ positions on the ring.`,
    `分布：${distribution.map(d => `${d.id}=${d.count}`).join(', ')}。偏差：${max - min}。虚拟节点 (vnodes) 解决此问题 — 每个物理节点在环上获得 100+ 个位置。`
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Consistent Hashing Ring', '交互式一致性哈希环') }}</div>

    <svg viewBox="0 0 300 300" class="ch-svg" role="img" :aria-label="t('Consistent hash ring visualization', '一致性哈希环可视化')">
      <circle :cx="CX" :cy="CY" :r="R" fill="none" stroke="var(--viz-border)" stroke-width="1.5" />

      <!-- Ownership arcs -->
      <template v-for="ko in keyOwnership" :key="'line-' + ko.id">
        <line
          v-if="ko.owner"
          :x1="ko.pos.x"
          :y1="ko.pos.y"
          :x2="hashPos(ko.owner.hash).x"
          :y2="hashPos(ko.owner.hash).y"
          :stroke="ko.owner.color"
          stroke-width="1"
          stroke-dasharray="3,3"
          opacity="0.4"
        />
      </template>

      <!-- Nodes -->
      <g v-for="np in nodePositions" :key="'node-' + np.id" class="ch-node">
        <circle :cx="np.pos.x" :cy="np.pos.y" r="16" :fill="np.color" stroke="#fff" stroke-width="2" />
        <text :x="np.pos.x" :y="np.pos.y + 1" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="11" font-weight="700">
          {{ np.id }}
        </text>
      </g>

      <!-- Keys -->
      <g v-for="ko in keyOwnership" :key="'key-' + ko.id" class="ch-key">
        <circle
          :cx="ko.pos.x"
          :cy="ko.pos.y"
          r="6"
          :fill="ko.owner?.color ?? 'var(--viz-muted)'"
          opacity="0.8"
          :class="{ 'ch-key-pop': ko.hash === animHash }"
        />
        <text
          :x="ko.pos.x"
          :y="ko.pos.y - 10"
          text-anchor="middle"
          :fill="ko.owner?.color ?? 'var(--viz-muted)'"
          font-size="7"
          font-weight="600"
        >
          {{ ko.id }}
        </text>
      </g>

      <!-- Center label -->
      <text :x="CX" :y="CY - 6" text-anchor="middle" fill="var(--viz-text)" font-size="12" font-weight="700">
        {{ nodes.length }} {{ t('nodes', '个节点') }}
      </text>
      <text :x="CX" :y="CY + 10" text-anchor="middle" fill="var(--viz-muted)" font-size="10">
        {{ keys.length }} {{ t('keys', '个键') }}
      </text>
    </svg>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="addKey">{{ t('Add Key', '添加键') }}</button>
      <button class="viz-btn" @click="addNode">{{ t('Add Node', '添加节点') }}</button>
      <button class="viz-btn" @click="removeNode">{{ t('Remove Node', '删除节点') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetScaleOut">{{ t('Scale Out', '扩容') }}</button>
      <button class="viz-btn" @click="presetNodeFailure">{{ t('Node Failure', '节点故障') }}</button>
      <button class="viz-btn" @click="presetHotSpot">{{ t('Hot Spot', '热点') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.ch-svg {
  width: 100%;
  max-width: 300px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.ch-node {
  transition: all var(--viz-transition);
}

.ch-key {
  transition: all var(--viz-transition);
}

.ch-key-pop {
  animation: viz-pulse 0.5s ease;
}
</style>
