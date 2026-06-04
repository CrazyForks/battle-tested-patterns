<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

interface AstNode {
  id: number;
  type: string;
  children: AstNode[];
  visited: boolean;
}

let nextId = 0;

function makeNode(type: string, children: AstNode[] = []): AstNode {
  return { id: nextId++, type, children, visited: false };
}

function buildTree(): AstNode {
  nextId = 0;
  return makeNode('Program', [
    makeNode('Function', [
      makeNode('Statement', [
        makeNode('Expression'),
        makeNode('Expression'),
      ]),
      makeNode('Statement', [
        makeNode('Expression'),
      ]),
    ]),
    makeNode('Function', [
      makeNode('Statement', [
        makeNode('Expression'),
      ]),
    ]),
  ]);
}

const tree = ref<AstNode>(buildTree());
const visiting = ref(false);
const currentNodeId = ref(-1);
const visitorType = ref<'print' | 'count'>('print');
const output = reactive<string[]>([]);
const nodeCount = ref(0);
const message = ref(t('Select a visitor type and click "Visit" to traverse the AST', '选择访问者类型并点击"访问"以遍历 AST'));

let aborted = false;
onUnmounted(() => { aborted = true; });

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function flatten(node: AstNode): AstNode[] {
  const result: AstNode[] = [node];
  for (const child of node.children) {
    result.push(...flatten(child));
  }
  return result;
}

const allNodes = computed(() => flatten(tree.value));
const totalNodes = computed(() => allNodes.value.length);
const visitedCount = computed(() => allNodes.value.filter(n => n.visited).length);

async function visitNode(node: AstNode, depth: number) {
  currentNodeId.value = node.id;
  await delay(420);

  if (visitorType.value === 'print') {
    const indent = '  '.repeat(depth);
    output.push(`${indent}visit(${node.type})`);
  } else {
    nodeCount.value++;
    output.push(`count = ${nodeCount.value}  (${node.type})`);
  }

  node.visited = true;

  for (const child of node.children) {
    await visitNode(child, depth + 1);
  }
}

async function startVisit() {
  if (visiting.value) return;
  visiting.value = true;
  output.length = 0;
  nodeCount.value = 0;

  const label = visitorType.value === 'print' ? 'Print Visitor' : 'Count Visitor';
  message.value = t(`${label} traversing...`, `${label} 遍历中...`);

  // Reset visited state
  for (const n of allNodes.value) {
    n.visited = false;
  }

  await visitNode(tree.value, 0);

  currentNodeId.value = -1;
  if (visitorType.value === 'print') {
    message.value = t(`Print Visitor finished — visited ${totalNodes.value} nodes`, `Print Visitor 完成 — 访问了 ${totalNodes.value} 个节点`);
  } else {
    message.value = t(`Count Visitor finished — total: ${nodeCount.value} nodes`, `Count Visitor 完成 — 总计：${nodeCount.value} 个节点`);
  }
  visiting.value = false;
}

function reset() {
  tree.value = buildTree();
  visiting.value = false;
  currentNodeId.value = -1;
  output.length = 0;
  nodeCount.value = 0;
  message.value = t('Select a visitor type and click "Visit" to traverse the AST', '选择访问者类型并点击"访问"以遍历 AST');
}

/* ---- Tree layout for SVG ---- */
interface LayoutNode {
  node: AstNode;
  x: number;
  y: number;
  children: LayoutNode[];
}

function layoutTree(node: AstNode, depth: number, xOff: { val: number }): LayoutNode {
  const children: LayoutNode[] = [];
  for (const child of node.children) {
    children.push(layoutTree(child, depth + 1, xOff));
  }

  let x: number;
  if (children.length === 0) {
    x = xOff.val;
    xOff.val += 72;
  } else {
    x = (children[0].x + children[children.length - 1].x) / 2;
  }

  return { node, x, y: depth * 60 + 30, children };
}

const treeLayout = computed(() => {
  const xOff = { val: 50 };
  return layoutTree(tree.value, 0, xOff);
});

function flattenLayout(l: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [l];
  for (const c of l.children) {
    result.push(...flattenLayout(c));
  }
  return result;
}

const layoutNodes = computed(() => flattenLayout(treeLayout.value));

interface Edge { from: LayoutNode; to: LayoutNode }

function collectEdges(l: LayoutNode): Edge[] {
  const edges: Edge[] = [];
  for (const c of l.children) {
    edges.push({ from: l, to: c });
    edges.push(...collectEdges(c));
  }
  return edges;
}

const edges = computed(() => collectEdges(treeLayout.value));
const svgW = computed(() => Math.max(360, layoutNodes.value.reduce((m, n) => Math.max(m, n.x), 0) + 70));
const svgH = computed(() => Math.max(160, layoutNodes.value.reduce((m, n) => Math.max(m, n.y), 0) + 50));

function nodeColor(n: AstNode): string {
  if (n.id === currentNodeId.value) return 'var(--viz-warning)';
  if (n.visited) return 'var(--viz-success)';
  return 'var(--viz-primary)';
}

function nodeRadius(type: string): number {
  if (type === 'Program') return 22;
  if (type === 'Function') return 20;
  if (type === 'Statement') return 18;
  return 16;
}

function shortLabel(type: string): string {
  if (type === 'Program') return 'Prog';
  if (type === 'Function') return 'Func';
  if (type === 'Statement') return 'Stmt';
  if (type === 'Expression') return 'Expr';
  return type;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Visitor Pattern', '交互式 Visitor 模式') }}</div>

    <!-- AST Tree -->
    <svg :viewBox="`0 0 ${svgW} ${svgH}`" class="vv-svg">
      <line
        v-for="(e, i) in edges"
        :key="'e-' + i"
        :x1="e.from.x"
        :y1="e.from.y"
        :x2="e.to.x"
        :y2="e.to.y"
        stroke="var(--viz-border)"
        stroke-width="1.5"
      />

      <g v-for="ln in layoutNodes" :key="ln.node.id" :transform="`translate(${ln.x}, ${ln.y})`">
        <circle
          :r="nodeRadius(ln.node.type)"
          :fill="nodeColor(ln.node)"
          stroke="#fff"
          stroke-width="1.5"
          :class="{ 'vv-pulse': ln.node.id === currentNodeId }"
        />
        <text
          text-anchor="middle"
          dominant-baseline="central"
          fill="#fff"
          font-size="10"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >{{ shortLabel(ln.node.type) }}</text>
        <!-- Visited badge -->
        <g v-if="ln.node.visited && ln.node.id !== currentNodeId">
          <circle
            :cx="nodeRadius(ln.node.type) - 2"
            :cy="-nodeRadius(ln.node.type) + 2"
            r="6"
            fill="var(--viz-success)"
            stroke="#fff"
            stroke-width="1"
          />
          <text
            :x="nodeRadius(ln.node.type) - 2"
            :y="-nodeRadius(ln.node.type) + 3"
            text-anchor="middle"
            dominant-baseline="central"
            fill="#fff"
            font-size="7"
            font-weight="700"
          >&#x2713;</text>
        </g>
      </g>
    </svg>

    <!-- Visitor type selector -->
    <div class="vv-visitor-select">
      <span class="vv-label">{{ t('Visitor:', '访问者：') }}</span>
      <button
        class="vv-type-btn"
        :class="{ 'vv-type-active': visitorType === 'print' }"
        :disabled="visiting"
        @click="visitorType = 'print'"
      >Print Visitor</button>
      <button
        class="vv-type-btn"
        :class="{ 'vv-type-active': visitorType === 'count' }"
        :disabled="visiting"
        @click="visitorType = 'count'"
      >Count Visitor</button>
    </div>

    <!-- Visitor output log -->
    <div v-if="output.length > 0" class="vv-output">
      <div class="vv-output-header">
        {{ t('Visitor Output', '访问者输出') }}
        <span class="vv-output-count">{{ visitedCount }}/{{ totalNodes }}</span>
      </div>
      <div class="vv-output-lines">
        <div v-for="(line, i) in output" :key="i" class="vv-output-line">{{ line }}</div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" :disabled="visiting" @click="startVisit">{{ t('Visit', '访问') }}</button>
      <button class="viz-btn viz-btn--danger" :disabled="visiting" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.vv-svg {
  width: 100%;
  max-width: 520px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 140px;
}

.vv-pulse {
  animation: vv-glow 0.4s ease;
}

.vv-visitor-select {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 0;
  flex-wrap: wrap;
}

.vv-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--viz-text);
}

.vv-type-btn {
  padding: 0.3rem 0.7rem;
  border: 2px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--viz-text);
  cursor: pointer;
  transition: all 0.15s;
}

.vv-type-btn:hover:not(:disabled) {
  border-color: var(--viz-primary);
}

.vv-type-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vv-type-active {
  border-color: var(--viz-primary);
  background: var(--viz-primary);
  color: #fff;
}

.vv-output {
  border: 1px solid var(--viz-border);
  border-radius: 8px;
  overflow: hidden;
  margin: 0.5rem 0;
}

.vv-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.7rem;
  background: var(--viz-border);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--viz-text);
  text-transform: uppercase;
}

.vv-output-count {
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
  color: var(--viz-muted);
}

.vv-output-lines {
  max-height: 180px;
  overflow-y: auto;
  padding: 0.4rem 0.7rem;
  background: var(--vp-c-bg);
}

.vv-output-line {
  font-size: 0.72rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  line-height: 1.6;
  white-space: pre;
}

@keyframes vv-glow {
  0% { transform: scale(1); }
  50% { transform: scale(1.18); }
  100% { transform: scale(1); }
}

@media (max-width: 640px) {
  .vv-svg {
    max-width: 100%;
  }
}
</style>
