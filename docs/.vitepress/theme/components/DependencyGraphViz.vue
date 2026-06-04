<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

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
const message = ref(t(
  'Click "Topo Sort" to find valid execution order — used by build systems, package managers, and task schedulers',
  '点击"拓扑排序"查找有效执行顺序 — 构建系统、包管理器和任务调度器都使用此算法'
));
const sorting = ref(false);
let presetRunning = false;

function getNode(id: string) {
  return nodes.value.find(n => n.id === id)!;
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

  message.value = t(
    `Kahn's algorithm: start with zero in-degree nodes: ${queue.join(', ')}. These have no dependencies — safe to execute first.`,
    `Kahn 算法：从入度为零的节点开始：${queue.join(', ')}。这些没有依赖 — 可以安全先执行。`
  );
  await delay(600);
  if (isAborted()) { sorting.value = false; return; }

  while (queue.length > 0) {
    const id = queue.shift()!;
    highlightNode.value = id;
    sortedOrder.value = [...sortedOrder.value, id];
    message.value = t(
      `Processing ${id} — removing its edges, decrementing neighbors' in-degree. This is how Make, Webpack, and Gradle resolve build order.`,
      `处理 ${id} — 移除其边，递减邻居的入度。Make、Webpack 和 Gradle 就是这样解析构建顺序的。`
    );
    await delay(500);
    if (isAborted()) { sorting.value = false; return; }

    for (const next of adj[id]) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  if (sortedOrder.value.length < nodes.value.length) {
    message.value = t(
      'Cycle detected — not all nodes processed! Circular dependencies are the #1 cause of deadlocks in package managers (npm, pip) and build systems.',
      '检测到环 — 未处理所有节点！循环依赖是包管理器（npm、pip）和构建系统中死锁的首要原因。'
    );
  } else {
    message.value = t(
      `Topological order: ${sortedOrder.value.join(' → ')}. O(V+E) time. Any DAG has at least one valid ordering — some have many.`,
      `拓扑排序：${sortedOrder.value.join(' → ')}。O(V+E) 时间。任何 DAG 至少有一个有效排序 — 有些有多个。`
    );
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
  message.value = t(
    `Added edge ${from} → ${to}. This might create a cycle — run topo sort to find out!`,
    `已添加边 ${from} → ${to}。这可能创建环 — 运行拓扑排序来确认！`
  );
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
  message.value = t(`Added node ${nextChar} — add edges to create dependencies`, `已添加节点 ${nextChar} — 添加边来创建依赖`);
}

function reset() {
  clearAll();
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
  sorting.value = false;
  presetRunning = false;
  message.value = t('Graph reset', '图已重置');
}

async function presetDiamondDep() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Diamond dependency: A→B, A→C, B→D, C→D. The classic pattern in build systems — D depends on both B and C. Running topo sort shows D must come last.',
    '菱形依赖：A→B，A→C，B→D，C→D。构建系统中的经典模式 — D 依赖 B 和 C。拓扑排序显示 D 必须在最后。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  await topoSort();
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'B and C can run in parallel — they have no mutual dependency. This is how Bazel and Turborepo parallelize builds: find independent tasks in the DAG.',
    'B 和 C 可以并行运行 — 它们没有相互依赖。这就是 Bazel 和 Turborepo 并行构建的方式：在 DAG 中找到独立任务。'
  );
  presetRunning = false;
}

async function presetCycleDetection() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Adding a back-edge D→A to create a cycle. Cycles make topological sort impossible — this is how npm detects circular dependencies.',
    '添加反向边 D→A 创建环。环使拓扑排序不可能 — npm 就是这样检测循环依赖的。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  edges.value.push({ from: 'D', to: 'A' });
  sortedOrder.value = [];
  message.value = t(
    'Cycle created: A→B→D→A. Now running topo sort — it will detect the cycle because not all nodes reach in-degree 0.',
    '环已创建：A→B→D→A。现在运行拓扑排序 — 它将检测到环，因为不是所有节点都能达到入度 0。'
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  await topoSort();
  presetRunning = false;
}

async function presetLinearChain() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  nodes.value = [
    { id: 'A', x: 40, y: 70 },
    { id: 'B', x: 120, y: 70 },
    { id: 'C', x: 200, y: 70 },
    { id: 'D', x: 280, y: 70 },
    { id: 'E', x: 350, y: 70 },
  ];
  edges.value = [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'C' },
    { from: 'C', to: 'D' },
    { from: 'D', to: 'E' },
  ];
  sortedOrder.value = [];
  message.value = t(
    'Linear chain: A→B→C→D→E. Only one valid order. No parallelism possible — this is the worst case for build performance. Critical path = total time.',
    '线性链：A→B→C→D→E。只有一个有效排序。无法并行 — 这是构建性能的最差情况。关键路径 = 总时间。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  await topoSort();
  presetRunning = false;
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
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetDiamondDep">{{ t('Diamond Dep', '菱形依赖') }}</button>
      <button class="viz-btn" @click="presetCycleDetection">{{ t('Cycle Detection', '环检测') }}</button>
      <button class="viz-btn" @click="presetLinearChain">{{ t('Linear Chain', '线性链') }}</button>
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
