<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const ORDER = 3; // max keys per node

interface BNode {
  keys: number[];
  children: BNode[];
  isLeaf: boolean;
  id: number;
}

let nextId = 0;
function createNode(isLeaf: boolean): BNode {
  return { keys: [], children: [], isLeaf, id: nextId++ };
}

const root = ref<BNode>(createNode(true));
const message = ref(
  t(
    'Insert values to build a B+ tree — the data structure behind every database index. MySQL InnoDB, PostgreSQL, and SQLite all use B+ trees.',
    '插入值来构建 B+ Tree — 每个数据库索引背后的数据结构。MySQL InnoDB、PostgreSQL 和 SQLite 都使用 B+ 树。',
  ),
);
const highlightIds = ref<Set<number>>(new Set());
const sorting = ref(false);
let presetRunning = false;

const history = useVizHistory<BNode>(createNode(true), {
  getMessage: () => message.value,
  onRestore: (s, msg) => {
    presetRunning = false;
    root.value = s;
    highlightIds.value = new Set();
    sorting.value = false;
    if (msg !== undefined) message.value = msg;
  },
});
function commitSnapshot(label: string) {
  history.commit(root.value, label);
}

function insertKey(
  node: BNode,
  key: number,
): { split: boolean; midKey: number; left: BNode; right: BNode } | null {
  if (node.isLeaf) {
    const idx = node.keys.findIndex((k) => k >= key);
    if (idx >= 0 && node.keys[idx] === key) return null;
    if (idx === -1) node.keys.push(key);
    else node.keys.splice(idx, 0, key);

    if (node.keys.length > ORDER) {
      const mid = Math.ceil(node.keys.length / 2);
      const right = createNode(true);
      right.keys = node.keys.splice(mid);
      return { split: true, midKey: right.keys[0], left: node, right };
    }
    return null;
  }

  let childIdx = node.keys.findIndex((k) => key < k);
  if (childIdx === -1) childIdx = node.children.length - 1;

  const result = insertKey(node.children[childIdx], key);
  if (!result) return null;

  node.keys.splice(childIdx, 0, result.midKey);
  node.children.splice(childIdx, 1, result.left, result.right);

  if (node.keys.length > ORDER) {
    const mid = Math.floor(node.keys.length / 2);
    const midKey = node.keys[mid];
    const right = createNode(false);
    right.keys = node.keys.splice(mid + 1);
    node.keys.splice(mid, 1);
    right.children = node.children.splice(mid + 1);
    return { split: true, midKey, left: node, right };
  }
  return null;
}

function doInsert(key: number): boolean {
  const allKeys = collectKeys(root.value);
  if (allKeys.includes(key)) return false;

  const result = insertKey(root.value, key);
  if (result) {
    const newRoot = createNode(false);
    newRoot.keys = [result.midKey];
    newRoot.children = [result.left, result.right];
    root.value = newRoot;
  }
  return true;
}

function insert() {
  const key = Math.floor(Math.random() * 99) + 1;
  if (!doInsert(key)) {
    message.value = t(`${key} already exists — duplicates rejected`, `${key} 已存在 — 拒绝重复值`);
    log(message.value, 'warning');
    return;
  }
  highlightIds.value = new Set();
  const depth = getDepth(root.value);
  message.value = t(
    `Inserted ${key} — tree depth: ${depth}. B+ trees maintain O(log n) height by splitting full nodes. With order ${ORDER}, each node holds 1-${ORDER} keys.`,
    `已插入 ${key} — 树深度：${depth}。B+ 树通过分裂满节点维持 O(log n) 高度。阶为 ${ORDER} 时，每个节点持有 1-${ORDER} 个键。`,
  );
  log(message.value, 'info');
  commitSnapshot(`insert ${key}`);
}

function collectKeys(node: BNode): number[] {
  if (node.isLeaf) return [...node.keys];
  return node.children.flatMap((c) => collectKeys(c));
}

function getDepth(node: BNode): number {
  if (node.isLeaf) return 1;
  return 1 + getDepth(node.children[0]);
}

async function search() {
  if (sorting.value) return;
  const allKeys = collectKeys(root.value);
  if (allKeys.length === 0) {
    message.value = t('Tree is empty — insert some keys first', '树为空 — 请先插入一些键');
    return;
  }
  sorting.value = true;
  const target = allKeys[Math.floor(Math.random() * allKeys.length)];
  highlightIds.value = new Set();
  message.value = t(
    `Searching for ${target}... traversing from root, comparing keys at each level. This is how SELECT * WHERE id = ${target} works in MySQL.`,
    `正在搜索 ${target}... 从根遍历，在每层比较键。这就是 MySQL 中 SELECT * WHERE id = ${target} 的工作方式。`,
  );

  let current = root.value;
  let comparisons = 0;
  while (current) {
    highlightIds.value = new Set([...highlightIds.value, current.id]);
    comparisons += current.keys.length;
    await delay(400);
    if (isAborted()) {
      sorting.value = false;
      return;
    }

    if (current.isLeaf) {
      if (current.keys.includes(target)) {
        message.value = t(
          `Found ${target} in leaf after ${comparisons} comparisons. Tree depth: ${getDepth(root.value)}. A B+ tree with 1M records needs only ~20 comparisons.`,
          `在 ${comparisons} 次比较后在叶节点找到 ${target}。树深度：${getDepth(root.value)}。100 万条记录的 B+ 树只需约 20 次比较。`,
        );
        log(message.value, 'success');
      }
      break;
    }

    let childIdx = current.keys.findIndex((k) => target < k);
    if (childIdx === -1) childIdx = current.children.length - 1;
    current = current.children[childIdx];
  }
  await delay(800);
  if (isAborted()) {
    sorting.value = false;
    return;
  }
  highlightIds.value = new Set();
  sorting.value = false;
}

function reset() {
  clearAll();
  nextId = 0;
  root.value = createNode(true);
  highlightIds.value = new Set();
  sorting.value = false;
  presetRunning = false;
  message.value = t('Tree cleared — insert keys to build a new tree', '树已清空 — 插入键构建新树');
  clearLog();
  history.reset();
}

function loadDemo() {
  reset();
  for (const k of [10, 20, 30, 40, 50, 5, 15, 25, 35]) {
    doInsert(k);
  }
  message.value = t(
    'Demo loaded: 9 keys inserted. Notice the balanced structure — all leaves at the same depth. This is the B+ tree invariant.',
    '示例已加载：已插入 9 个键。注意平衡结构 — 所有叶子在同一深度。这是 B+ 树的不变量。',
  );
  log(message.value, 'info');
  commitSnapshot('load demo (9 keys)');
}

async function presetSplitDemo() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Inserting keys one by one to show node splitting. When a node exceeds order (3 keys), it splits into two and promotes the middle key.',
    '逐个插入键以展示节点分裂。当节点超过阶（3 个键）时，它分裂为两个并提升中间键。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  const keys = [10, 20, 30, 40];
  for (const k of keys) {
    if (!presetRunning || isAborted()) return;
    doInsert(k);
    commitSnapshot(`insert ${k}`);
    const depth = getDepth(root.value);
    log(t(`insert ${k} (depth ${depth})`, `插入 ${k}（深度 ${depth}）`), 'info');
    message.value = t(
      `Inserted ${k} — depth ${depth}. ${k === 40 ? 'Split happened! The root grew taller. This is the only way a B+ tree increases height — always balanced.' : 'Node not full yet, no split needed.'}`,
      `已插入 ${k} — 深度 ${depth}。${k === 40 ? '发生分裂！根变高了。这是 B+ 树增加高度的唯一方式 — 始终平衡。' : '节点未满，无需分裂。'}`,
    );
    await delay(800);
    if (!presetRunning || isAborted()) return;
  }
  log(
    t(
      'Node split: B+ tree grows from root — the only way height increases, guaranteeing balance',
      '节点分裂：B+ 树从根生长 — 高度增加的唯一方式，保证平衡',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetSequentialInsert() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Sequential insert: keys 1-12 in order. This is the worst case for naive BSTs (O(n) depth), but B+ trees stay balanced via splits.',
    '顺序插入：按顺序插入 1-12。这是朴素 BST 的最坏情况（O(n) 深度），但 B+ 树通过分裂保持平衡。',
  );
  await delay(800);
  for (let k = 1; k <= 12; k++) {
    if (!presetRunning || isAborted()) return;
    doInsert(k);
    commitSnapshot(`insert ${k}`);
    const depth = getDepth(root.value);
    log(t(`insert ${k} (depth ${depth})`, `插入 ${k}（深度 ${depth}）`), 'info');
    message.value = t(
      `Inserted ${k} — depth ${depth}. ${depth > 1 ? `${k} keys fit in ${depth} levels. A naive BST would need ${k} levels.` : 'Still fits in one node.'}`,
      `已插入 ${k} — 深度 ${depth}。${depth > 1 ? `${k} 个键只需 ${depth} 层。朴素 BST 需要 ${k} 层。` : '仍在一个节点内。'}`,
    );
    await delay(500);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    `12 sequential keys in ${getDepth(root.value)} levels. A BST would be a linked list (depth 12). This is why databases use B+ trees, not BSTs.`,
    `12 个顺序键只需 ${getDepth(root.value)} 层。BST 会退化为链表（深度 12）。这就是为什么数据库使用 B+ 树而非 BST。`,
  );
  log(
    t(
      'B+ tree guarantees O(log n) height even with sequential inserts — BST degenerates to O(n)',
      'B+ 树即使顺序插入也保证 O(log n) 高度 — BST 退化为 O(n)',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetRangeQuery() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  for (const k of [10, 20, 30, 40, 50, 5, 15, 25, 35, 45]) {
    doInsert(k);
  }
  commitSnapshot('load range query data');
  message.value = t(
    'Range query: B+ tree leaf nodes form a linked list, enabling efficient range scans. SELECT * WHERE id BETWEEN 15 AND 35 traverses only the relevant leaves.',
    '范围查询：B+ 树叶节点形成链表，支持高效范围扫描。SELECT * WHERE id BETWEEN 15 AND 35 只遍历相关叶子。',
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  sorting.value = true;
  const rangeKeys = collectKeys(root.value)
    .filter((k) => k >= 15 && k <= 35)
    .sort((a, b) => a - b);
  for (const k of rangeKeys) {
    if (!presetRunning || isAborted()) {
      sorting.value = false;
      return;
    }
    let current = root.value;
    while (current) {
      if (current.isLeaf && current.keys.includes(k)) {
        highlightIds.value = new Set([current.id]);
        break;
      }
      let childIdx = current.keys.findIndex((ck) => k < ck);
      if (childIdx === -1) childIdx = current.children.length - 1;
      current = current.children[childIdx];
    }
    message.value = t(`Range scan: found ${k}`, `范围扫描：找到 ${k}`);
    await delay(500);
    if (!presetRunning || isAborted()) {
      sorting.value = false;
      return;
    }
  }
  highlightIds.value = new Set();
  sorting.value = false;
  message.value = t(
    `Range scan complete: found ${rangeKeys.length} keys (${rangeKeys.join(', ')}). Leaf-level linked list makes this O(log n + k) where k = result count.`,
    `范围扫描完成：找到 ${rangeKeys.length} 个键（${rangeKeys.join(', ')}）。叶级链表使其为 O(log n + k)，其中 k = 结果数量。`,
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

interface LayoutNode {
  node: BNode;
  x: number;
  y: number;
  children: LayoutNode[];
}

function layoutBTree(node: BNode, depth: number, xOffset: { val: number }): LayoutNode {
  const childLayouts: LayoutNode[] = [];

  if (!node.isLeaf) {
    for (const child of node.children) {
      childLayouts.push(layoutBTree(child, depth + 1, xOffset));
    }
  }

  let x: number;
  const nodeWidth = Math.max(node.keys.length * 28 + 10, 40);

  if (childLayouts.length === 0) {
    x = xOffset.val + nodeWidth / 2;
    xOffset.val += nodeWidth + 12;
  } else {
    x = (childLayouts[0].x + childLayouts[childLayouts.length - 1].x) / 2;
  }

  return { node, x, y: depth * 60 + 30, children: childLayouts };
}

const treeLayout = computed(() => {
  const xOffset = { val: 20 };
  return layoutBTree(root.value, 0, xOffset);
});

function flattenLayout(layout: LayoutNode): LayoutNode[] {
  return [layout, ...layout.children.flatMap((c) => flattenLayout(c))];
}

const allLayoutNodes = computed(() => flattenLayout(treeLayout.value));
const svgW = computed(() =>
  Math.max(
    300,
    allLayoutNodes.value.reduce((max, n) => Math.max(max, n.x + 60), 0),
  ),
);
const svgH = computed(() =>
  Math.max(
    80,
    allLayoutNodes.value.reduce((max, n) => Math.max(max, n.y + 30), 0),
  ),
);

function getEdges(layout: LayoutNode): { from: LayoutNode; to: LayoutNode }[] {
  const edges: { from: LayoutNode; to: LayoutNode }[] = [];
  for (const child of layout.children) {
    edges.push({ from: layout, to: child });
    edges.push(...getEdges(child));
  }
  return edges;
}

const edges = computed(() => getEdges(treeLayout.value));
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">
      {{ t('Interactive B+ Tree', '交互式 B+ Tree') }} (order={{ ORDER }})
    </div>

    <svg
      :viewBox="`0 0 ${svgW} ${svgH}`"
      class="bptree-svg"
      role="img"
      :aria-label="t('B+ tree visualization', 'B+ 树可视化')"
    >
      <!-- Edges -->
      <line
        v-for="(e, i) in edges"
        :key="'e' + i"
        :x1="e.from.x"
        :y1="e.from.y + 12"
        :x2="e.to.x"
        :y2="e.to.y - 12"
        stroke="var(--viz-border)"
        stroke-width="1"
      />

      <!-- Nodes -->
      <g
        v-for="ln in allLayoutNodes"
        v-show="ln.node.keys.length > 0"
        :key="ln.node.id"
        :transform="`translate(${ln.x}, ${ln.y})`"
      >
        <rect
          :x="-(ln.node.keys.length * 14 + 5)"
          y="-12"
          :width="ln.node.keys.length * 28 + 10"
          height="24"
          rx="4"
          :fill="
            highlightIds.has(ln.node.id)
              ? 'var(--viz-warning)'
              : ln.node.isLeaf
                ? 'var(--viz-primary)'
                : 'var(--viz-muted)'
          "
          stroke="var(--viz-border)"
          stroke-width="1"
        />
        <text
          v-for="(key, ki) in ln.node.keys"
          :key="ki"
          :x="-(ln.node.keys.length * 14) + ki * 28 + 14"
          y="1"
          text-anchor="middle"
          dominant-baseline="central"
          fill="#fff"
          font-size="10"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >
          {{ key }}
        </text>
      </g>

      <!-- Empty state -->
      <text
        v-if="root.keys.length === 0"
        :x="svgW / 2"
        :y="svgH / 2"
        text-anchor="middle"
        fill="var(--viz-muted)"
        font-size="13"
      >
        {{ t('Empty — insert keys to build the tree', '空 - 插入键来构建树') }}
      </text>
    </svg>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="insert" :disabled="sorting">
        {{ t('Insert Random', '随机插入') }}
      </button>
      <button class="viz-btn" @click="search" :disabled="sorting">
        {{ t('Search Random', '随机搜索') }}
      </button>
      <button class="viz-btn" @click="loadDemo" :disabled="sorting">{{ t('Demo', '示例') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetSplitDemo">
        {{ t('Node Splitting', '节点分裂') }}
      </button>
      <button class="viz-btn" @click="presetSequentialInsert">
        {{ t('Sequential Insert', '顺序插入') }}
      </button>
      <button class="viz-btn" @click="presetRangeQuery">{{ t('Range Query', '范围查询') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.bptree-svg {
  width: 100%;
  max-width: 600px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 80px;
}
</style>
