<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
onUnmounted(() => { for (const tid of pendingTimers) clearTimeout(tid); });

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
const message = ref(t('Add keys to see which node owns them. Try removing a node!', '添加键来查看哪个节点拥有它们。试试删除一个节点！'));
const animHash = ref(-1);
let nextKeyId = 1;

function hashPos(h: number) {
  const angle = h * 2 * Math.PI - Math.PI / 2;
  return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 37) + s.charCodeAt(i)) | 0;
  }
  return ((h % 1000) + 1000) % 1000 / 1000;
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
  message.value = t(`Key "${id}" (hash=${h.toFixed(2)}) → owned by node ${owner?.id ?? 'none'}`, `键 "${id}" (hash=${h.toFixed(2)}) → 归属节点 ${owner?.id ?? '无'}`);
  const tid = setTimeout(() => { pendingTimers.delete(tid); animHash.value = -1; }, 500);
  pendingTimers.add(tid);
}

function addNode() {
  if (nodes.value.length >= 6) { message.value = t('Max 6 nodes', '最多 6 个节点'); return; }
  const id = String.fromCharCode(65 + nodes.value.length);
  const h = simpleHash(id + Date.now());
  nodes.value.push({ id, hash: h, color: COLORS[nodes.value.length] });
  message.value = t(`Added node ${id} at position ${h.toFixed(2)} — some keys may have moved!`, `已添加节点 ${id}，位置 ${h.toFixed(2)} — 部分键可能已迁移！`);
}

function removeNode() {
  if (nodes.value.length <= 1) { message.value = t('Need at least 1 node', '至少需要 1 个节点'); return; }
  const removed = nodes.value.pop()!;
  message.value = t(`Removed node ${removed.id} — only its keys are redistributed (minimal disruption!)`, `已删除节点 ${removed.id} — 仅其键被重新分配（最小影响！）`);
}

function reset() {
  nodes.value = [
    { id: 'A', hash: 0.0, color: COLORS[0] },
    { id: 'B', hash: 0.33, color: COLORS[1] },
    { id: 'C', hash: 0.66, color: COLORS[2] },
  ];
  keys.value = [];
  nextKeyId = 1;
  message.value = t('Reset! Add keys to see consistent hashing in action.', '已重置！添加键来查看一致性哈希的效果。');
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Consistent Hashing Ring', '交互式一致性哈希环') }}</div>

    <svg viewBox="0 0 300 300" class="ch-svg">
      <circle :cx="CX" :cy="CY" :r="R" fill="none" stroke="var(--viz-border)" stroke-width="1.5" />

      <!-- Ownership arcs -->
      <template v-for="(ko, i) in keyOwnership" :key="'line-' + ko.id">
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
    </div>

    <div class="viz-status">{{ message }}</div>
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
  transition: all 0.3s ease;
}

.ch-key {
  transition: all 0.3s ease;
}

.ch-key-pop {
  animation: key-pop 0.5s ease;
}

@keyframes key-pop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.8); }
}
</style>
