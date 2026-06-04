<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

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
const message = ref(t('Insert values to build a B+ tree', '插入值来构建 B+ Tree'));
const highlightIds = ref<Set<number>>(new Set());

function insertKey(node: BNode, key: number): { split: boolean; midKey: number; left: BNode; right: BNode } | null {
  if (node.isLeaf) {
    const idx = node.keys.findIndex(k => k >= key);
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

  let childIdx = node.keys.findIndex(k => key < k);
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

function insert() {
  const key = Math.floor(Math.random() * 99) + 1;
  const allKeys = collectKeys(root.value);
  if (allKeys.includes(key)) {
    message.value = t(`${key} already exists`, `${key} 已存在`);
    return;
  }

  const result = insertKey(root.value, key);
  if (result) {
    const newRoot = createNode(false);
    newRoot.keys = [result.midKey];
    newRoot.children = [result.left, result.right];
    root.value = newRoot;
  }

  highlightIds.value = new Set();
  message.value = t(`Inserted ${key}`, `已插入 ${key}`);
}

function collectKeys(node: BNode): number[] {
  if (node.isLeaf) return [...node.keys];
  return node.children.flatMap(c => collectKeys(c));
}

async function search() {
  const allKeys = collectKeys(root.value);
  if (allKeys.length === 0) {
    message.value = t('Tree is empty', '树为空');
    return;
  }
  const target = allKeys[Math.floor(Math.random() * allKeys.length)];
  highlightIds.value = new Set();
  message.value = t(`Searching for ${target}...`, `正在搜索 ${target}...`);

  let current = root.value;
  while (current) {
    highlightIds.value = new Set([...highlightIds.value, current.id]);
    await delay(400);
    if (aborted) return;

    if (current.isLeaf) {
      if (current.keys.includes(target)) {
        message.value = t(`Found ${target} in leaf node`, `在叶节点中找到 ${target}`);
      }
      break;
    }

    let childIdx = current.keys.findIndex(k => target < k);
    if (childIdx === -1) childIdx = current.children.length - 1;
    current = current.children[childIdx];
  }
  await delay(800);
  if (aborted) return;
  highlightIds.value = new Set();
}

function reset() {
  nextId = 0;
  root.value = createNode(true);
  highlightIds.value = new Set();
  message.value = t('Tree cleared', '树已清空');
}

function loadDemo() {
  reset();
  for (const k of [10, 20, 30, 40, 50, 5, 15, 25, 35]) {
    const result = insertKey(root.value, k);
    if (result) {
      const newRoot = createNode(false);
      newRoot.keys = [result.midKey];
      newRoot.children = [result.left, result.right];
      root.value = newRoot;
    }
  }
  message.value = t('Demo loaded: 9 keys inserted', '示例已加载：已插入 9 个键');
}

let aborted = false;
onUnmounted(() => { aborted = true; });

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  return [layout, ...layout.children.flatMap(c => flattenLayout(c))];
}

const allLayoutNodes = computed(() => flattenLayout(treeLayout.value));
const svgW = computed(() => Math.max(300, allLayoutNodes.value.reduce((max, n) => Math.max(max, n.x + 60), 0)));
const svgH = computed(() => Math.max(80, allLayoutNodes.value.reduce((max, n) => Math.max(max, n.y + 30), 0)));

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
    <div class="viz-title">{{ t('Interactive B+ Tree', '交互式 B+ Tree') }} (order={{ ORDER }})</div>

    <svg :viewBox="`0 0 ${svgW} ${svgH}`" class="bptree-svg">
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
      <g v-for="ln in allLayoutNodes" :key="ln.node.id" :transform="`translate(${ln.x}, ${ln.y})`">
        <rect
          :x="-(ln.node.keys.length * 14 + 5)"
          y="-12"
          :width="ln.node.keys.length * 28 + 10"
          height="24"
          rx="4"
          :fill="highlightIds.has(ln.node.id) ? 'var(--viz-warning)' :
                 ln.node.isLeaf ? 'var(--viz-primary)' : 'var(--viz-muted)'"
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
        >{{ key }}</text>
      </g>

      <!-- Empty state -->
      <text v-if="root.keys.length === 0" :x="svgW / 2" :y="svgH / 2" text-anchor="middle" fill="var(--viz-muted)" font-size="13">
        {{ t('Empty — insert keys to build the tree', '空 - 插入键来构建树') }}
      </text>
    </svg>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="insert">{{ t('Insert Random', '随机插入') }}</button>
      <button class="viz-btn" @click="search">{{ t('Search Random', '随机搜索') }}</button>
      <button class="viz-btn" @click="loadDemo">{{ t('Demo', '示例') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
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
