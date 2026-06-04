<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

interface GNode {
  id: string;
  x: number;
  y: number;
}

interface GEdge {
  from: string;
  to: string;
}

const nodes = ref<GNode[]>([
  { id: 'A', x: 60, y: 50 },
  { id: 'B', x: 180, y: 30 },
  { id: 'C', x: 180, y: 110 },
  { id: 'D', x: 300, y: 70 },
]);

const edges = ref<GEdge[]>([
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'C', to: 'D' },
]);

const sortedOrder = ref<string[]>([]);
const highlightNode = ref<string>('');
const message = ref(t('Click "Topo Sort" to find valid execution order', '点击"拓扑排序"查找有效执行顺序'));
const sorting = ref(false);

function getNode(id: string) {
  return nodes.value.find(n => n.id === id)!;
}

let aborted = false;
onUnmounted(() => { aborted = true; });

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function topoSort() {
  if (sorting.value) return;
  sorting.value = true;
  sortedOrder.value = [];
  highlightNode.value = '';

  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  for (const n of nodes.value) {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  }
  for (const e of edges.value) {
    adj[e.from].push(e.to);
    inDegree[e.to]++;
  }

  const queue: string[] = [];
  for (const n of nodes.value) {
    if (inDegree[n.id] === 0) queue.push(n.id);
  }

  message.value = t(`Starting — zero in-degree: ${queue.join(', ')}`, `开始 - 入度为零: ${queue.join(', ')}`);
  await delay(600);
  if (aborted) return;

  while (queue.length > 0) {
    const id = queue.shift()!;
    highlightNode.value = id;
    sortedOrder.value = [...sortedOrder.value, id];
    message.value = t(`Processing ${id} (in-degree = 0)`, `处理 ${id}（入度 = 0）`);
    await delay(500);
    if (aborted) return;

    for (const next of adj[id]) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  if (sortedOrder.value.length < nodes.value.length) {
    message.value = t('Cycle detected — not all nodes processed!', '检测到环 - 未处理所有节点！');
  } else {
    message.value = t(`Topological order: ${sortedOrder.value.join(' → ')}`, `拓扑排序: ${sortedOrder.value.join(' → ')}`);
  }
  highlightNode.value = '';
  sorting.value = false;
}

function addEdge() {
  const ids = nodes.value.map(n => n.id);
  const from = ids[Math.floor(Math.random() * ids.length)];
  let to = ids[Math.floor(Math.random() * ids.length)];
  if (from === to) to = ids[(ids.indexOf(to) + 1) % ids.length];

  if (edges.value.some(e => e.from === from && e.to === to)) {
    message.value = t(`Edge ${from}→${to} already exists`, `边 ${from}→${to} 已存在`);
    return;
  }

  edges.value.push({ from, to });
  sortedOrder.value = [];
  message.value = t(`Added edge ${from} → ${to}`, `已添加边 ${from} → ${to}`);
}

function addNode() {
  const nextChar = String.fromCharCode(65 + nodes.value.length);
  if (nodes.value.length >= 8) {
    message.value = t('Maximum 8 nodes', '最多 8 个节点');
    return;
  }
  const angles = [0, Math.PI / 3, Math.PI / 2, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3, Math.PI / 6, (5 * Math.PI) / 6];
  const a = angles[nodes.value.length % angles.length];
  nodes.value.push({
    id: nextChar,
    x: 180 + Math.cos(a) * 100 + Math.random() * 30,
    y: 80 + Math.sin(a) * 60 + Math.random() * 20,
  });
  sortedOrder.value = [];
  message.value = t(`Added node ${nextChar}`, `已添加节点 ${nextChar}`);
}

function reset() {
  nodes.value = [
    { id: 'A', x: 60, y: 50 },
    { id: 'B', x: 180, y: 30 },
    { id: 'C', x: 180, y: 110 },
    { id: 'D', x: 300, y: 70 },
  ];
  edges.value = [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
  ];
  sortedOrder.value = [];
  highlightNode.value = '';
  message.value = t('Graph reset', '图已重置');
  sorting.value = false;
}

const sortedIdx = computed(() => {
  const map: Record<string, number> = {};
  sortedOrder.value.forEach((id, i) => { map[id] = i; });
  return map;
});
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Dependency Graph', '交互式依赖图') }}</div>

    <svg viewBox="0 0 380 160" class="depgraph-svg">
      <defs>
        <marker id="dg-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--viz-border)" />
        </marker>
      </defs>

      <!-- Edges -->
      <line
        v-for="(e, i) in edges"
        :key="'e' + i"
        :x1="getNode(e.from).x"
        :y1="getNode(e.from).y"
        :x2="getNode(e.to).x"
        :y2="getNode(e.to).y"
        stroke="var(--viz-border)"
        stroke-width="1.5"
        marker-end="url(#dg-arrow)"
      />

      <!-- Nodes -->
      <g v-for="n in nodes" :key="n.id" :transform="`translate(${n.x}, ${n.y})`">
        <circle
          r="18"
          :fill="highlightNode === n.id ? 'var(--viz-warning)' :
                 sortedIdx[n.id] !== undefined ? 'var(--viz-success)' :
                 'var(--viz-primary)'"
          stroke="#fff"
          stroke-width="2"
        />
        <text
          text-anchor="middle"
          dominant-baseline="central"
          fill="#fff"
          font-size="13"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >{{ n.id }}</text>
        <text
          v-if="sortedIdx[n.id] !== undefined"
          y="26"
          text-anchor="middle"
          fill="var(--viz-text)"
          font-size="9"
          font-weight="600"
          font-family="var(--vp-font-family-mono)"
        >#{{ sortedIdx[n.id] + 1 }}</text>
      </g>
    </svg>

    <!-- Sorted order display -->
    <div v-if="sortedOrder.length > 0" class="dg-order">
      <span class="viz-label">{{ t('Order:', '顺序:') }}&nbsp;</span>
      <span v-for="(id, i) in sortedOrder" :key="id" class="dg-order-item">
        {{ id }}<span v-if="i < sortedOrder.length - 1"> → </span>
      </span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="topoSort" :disabled="sorting">{{ t('Topo Sort', '拓扑排序') }}</button>
      <button class="viz-btn" @click="addNode" :disabled="sorting">{{ t('+ Node', '+ 节点') }}</button>
      <button class="viz-btn" @click="addEdge" :disabled="sorting">{{ t('+ Edge', '+ 边') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.depgraph-svg {
  width: 100%;
  max-width: 400px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 120px;
}

.dg-order {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0.5rem 0;
  font-size: 0.85rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--viz-text);
}

.dg-order-item {
  color: var(--viz-success);
}
</style>
