<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface AstNode {
  id: number;
  type: string;
  children: AstNode[];
  visited: boolean;
}

let nextId = 0;
let presetRunning = false;

function makeNode(type: string, children: AstNode[] = []): AstNode {
  return { id: nextId++, type, children, visited: false };
}

function buildTree(): AstNode {
  nextId = 0;
  return makeNode('Program', [
    makeNode('Function', [
      makeNode('Statement', [makeNode('Expression'), makeNode('Expression')]),
      makeNode('Statement', [makeNode('Expression')]),
    ]),
    makeNode('Function', [makeNode('Statement', [makeNode('Expression')])]),
  ]);
}

const tree = ref<AstNode>(buildTree());
const visiting = ref(false);
const currentNodeId = ref(-1);
const visitorType = ref<'print' | 'count'>('print');
const output = reactive<string[]>([]);
const nodeCount = ref(0);
const message = ref(
  t(
    'Select a visitor type and click "Visit" to traverse the AST',
    '选择访问者类型并点击"访问"以遍历 AST',
  ),
);

/* ── Time-travel history ── */
interface VisitorSnapshot {
  tree: AstNode;
  output: string[];
  nodeCount: number;
  visitorType: string;
}

const vizHistory = useVizHistory<VisitorSnapshot>(
  { tree: buildTree(), output: [], nodeCount: 0, visitorType: 'print' },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      tree.value = snap.tree;
      output.length = 0;
      output.push(...snap.output);
      nodeCount.value = snap.nodeCount;
      visitorType.value = snap.visitorType as 'print' | 'count';
      currentNodeId.value = -1;
      visiting.value = false;
      if (msg !== undefined) message.value = msg;
    },
  },
);

function flatten(node: AstNode): AstNode[] {
  const result: AstNode[] = [node];
  for (const child of node.children) {
    result.push(...flatten(child));
  }
  return result;
}

const allNodes = computed(() => flatten(tree.value));
const totalNodes = computed(() => allNodes.value.length);
const visitedCount = computed(() => allNodes.value.filter((n) => n.visited).length);

async function visitNode(node: AstNode, depth: number) {
  currentNodeId.value = node.id;
  await delay(420);
  if (isAborted()) return;

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

  for (const n of allNodes.value) {
    n.visited = false;
  }

  await visitNode(tree.value, 0);

  currentNodeId.value = -1;
  if (visitorType.value === 'print') {
    message.value = t(
      `Print Visitor finished — visited ${totalNodes.value} nodes`,
      `Print Visitor 完成 — 访问了 ${totalNodes.value} 个节点`,
    );
    log(
      t(`Print Visitor: ${totalNodes.value} nodes`, `Print Visitor：${totalNodes.value} 个节点`),
      'success',
    );
  } else {
    message.value = t(
      `Count Visitor finished — total: ${nodeCount.value} nodes`,
      `Count Visitor 完成 — 总计：${nodeCount.value} 个节点`,
    );
    log(
      t(`Count Visitor: total=${nodeCount.value}`, `Count Visitor：总计=${nodeCount.value}`),
      'success',
    );
  }
  visiting.value = false;
  vizHistory.commit(
    {
      tree: tree.value,
      output: [...output],
      nodeCount: nodeCount.value,
      visitorType: visitorType.value,
    },
    `visit ${visitorType.value}`,
  );
}

function reset() {
  clearAll();
  presetRunning = false;
  tree.value = buildTree();
  visiting.value = false;
  currentNodeId.value = -1;
  output.length = 0;
  nodeCount.value = 0;
  clearLog();
  message.value = t(
    'Select a visitor type and click "Visit" to traverse the AST',
    '选择访问者类型并点击"访问"以遍历 AST',
  );
  vizHistory.reset();
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

interface Edge {
  from: LayoutNode;
  to: LayoutNode;
}

function collectEdges(l: LayoutNode): Edge[] {
  const edges: Edge[] = [];
  for (const c of l.children) {
    edges.push({ from: l, to: c });
    edges.push(...collectEdges(c));
  }
  return edges;
}

const edges = computed(() => collectEdges(treeLayout.value));
const svgW = computed(() =>
  Math.max(360, layoutNodes.value.reduce((m, n) => Math.max(m, n.x), 0) + 70),
);
const svgH = computed(() =>
  Math.max(160, layoutNodes.value.reduce((m, n) => Math.max(m, n.y), 0) + 50),
);

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

async function presetPrintVisitor() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'The classic Visitor pattern separates the algorithm from the object structure. Babel uses visitors to transform AST nodes — babel-plugin-transform-arrow-functions visits ArrowFunctionExpression. ESLint rules are visitors that check AST nodes for violations.',
    '经典的 Visitor 模式将算法与对象结构分离。Babel 使用访问者来转换 AST 节点 — babel-plugin-transform-arrow-functions 访问 ArrowFunctionExpression。ESLint 规则就是检查 AST 节点是否违规的访问者。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  visitorType.value = 'print';
  await startVisit();
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'The visitor traversed depth-first (pre-order). Each node type can have its own handler. Adding a new operation (like type-checking) means adding a new visitor class, not modifying the AST node classes — this is the Open/Closed Principle.',
    '访问者进行了深度优先（前序）遍历。每种节点类型可以有自己的处理程序。添加新操作（如类型检查）意味着添加新的访问者类，而不是修改 AST 节点类 — 这就是开闭原则。',
  );
  log(
    t('Open/Closed: new visitor, not new node methods', '开闭原则：新增访问者，不修改节点方法'),
    'highlight',
  );
  presetRunning = false;
}

async function presetCountVisitor() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'A counting visitor demonstrates accumulation across the tree. This is how code coverage tools work — Istanbul/NYC traverse the AST and count nodes to instrument. rustc uses visitors to count and verify various properties during compilation.',
    '计数访问者展示了跨树的累积操作。代码覆盖率工具就是这样工作的 — Istanbul/NYC 遍历 AST 并计数节点进行插桩。rustc 使用访问者在编译期间计数和验证各种属性。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  visitorType.value = 'count';
  await startVisit();
  if (!presetRunning || isAborted()) return;
  message.value = t(
    "Both visitors traverse the same tree structure but produce different results. This is the key insight: the structure is stable, the operations vary. Java's FileVisitor and Python's ast.NodeVisitor follow this same pattern.",
    '两个访问者遍历相同的树结构但产生不同的结果。这是关键洞察：结构是稳定的，操作是变化的。Java 的 FileVisitor 和 Python 的 ast.NodeVisitor 遵循相同的模式。',
  );
  log(
    t('Same structure, different visitors — stable vs varying', '同结构不同访问者 — 稳定 vs 变化'),
    'highlight',
  );
  presetRunning = false;
}

async function presetBothVisitors() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Running two different visitors on the same AST shows the pattern's power — the tree doesn't change, only the visitor does. This is double dispatch: the call depends on both the node type AND the visitor type.",
    '在同一个 AST 上运行两个不同的访问者展示了模式的威力 — 树不变，只有访问者变。这就是双重分派：调用同时取决于节点类型和访问者类型。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  visitorType.value = 'print';
  await startVisit();
  if (!presetRunning || isAborted()) return;
  await delay(600);
  if (!presetRunning || isAborted()) return;
  visitorType.value = 'count';
  tree.value = buildTree();
  await startVisit();
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'In real compilers, the AST is visited many times — once for type checking, once for optimization, once for code generation. Clang/LLVM uses the CRTP visitor pattern (RecursiveASTVisitor) for this exact purpose.',
    '在真实的编译器中，AST 会被多次访问 — 一次用于类型检查，一次用于优化，一次用于代码生成。Clang/LLVM 使用 CRTP 访问者模式（RecursiveASTVisitor）正是为了这个目的。',
  );
  log(
    t('Double dispatch: node type × visitor type', '双重分派：节点类型 × 访问者类型'),
    'highlight',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Visitor Pattern', '交互式 Visitor 模式') }}</div>

    <!-- AST Tree -->
    <svg
      :viewBox="`0 0 ${svgW} ${svgH}`"
      class="vv-svg"
      role="img"
      :aria-label="t('Visitor pattern AST visualization', '访问者模式 AST 可视化')"
    >
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
        >
          {{ shortLabel(ln.node.type) }}
        </text>
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
          >
            &#x2713;
          </text>
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
      >
        Print Visitor
      </button>
      <button
        class="vv-type-btn"
        :class="{ 'vv-type-active': visitorType === 'count' }"
        :disabled="visiting"
        @click="visitorType = 'count'"
      >
        Count Visitor
      </button>
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
      <button class="viz-btn viz-btn--primary" :disabled="visiting" @click="startVisit">
        {{ t('Visit', '访问') }}
      </button>
      <button class="viz-btn viz-btn--danger" :disabled="visiting" @click="reset">
        {{ t('Reset', '重置') }}
      </button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <button class="viz-btn" :disabled="visiting && !presetRunning" @click="presetPrintVisitor">
        {{ t('Print Traversal', '打印遍历') }}
      </button>
      <button class="viz-btn" :disabled="visiting && !presetRunning" @click="presetCountVisitor">
        {{ t('Count Traversal', '计数遍历') }}
      </button>
      <button class="viz-btn" :disabled="visiting && !presetRunning" @click="presetBothVisitors">
        {{ t('Compare Visitors', '对比访问者') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
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
  animation: viz-pulse 0.4s ease;
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
  border-radius: var(--viz-radius-sm);
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
  border-radius: var(--viz-radius-sm);
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

@media (width <= 640px) {
  .vv-svg {
    max-width: 100%;
  }
}
</style>
