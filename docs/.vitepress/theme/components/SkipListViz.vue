<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

interface SkipNode {
  val: number;
  levels: number;
}

const nodes = ref<SkipNode[]>([]);
const message = ref(t(
  'Insert values to build a skip list — or pick a scenario to see O(log n) search in action',
  '插入值来构建 Skip List — 或选择场景观看 O(log n) 搜索过程'
));
const highlightPath = ref<{ nodeIdx: number; level: number }[]>([]);
const searchTarget = ref<number | null>(null);
let presetRunning = false;

const MAX_LEVEL = 4;
const NODE_W = 36;
const NODE_H = 22;
const GAP = 8;
const LEFT_PAD = 50;
const TOP_PAD = 20;

function randomLevel(): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && Math.random() < 0.5) lvl++;
  return lvl;
}

const maxLevel = computed(() =>
  nodes.value.length === 0 ? 1 : Math.max(...nodes.value.map(n => n.levels))
);

const svgW = computed(() => LEFT_PAD + (nodes.value.length + 2) * (NODE_W + GAP) + 40);
const svgH = computed(() => TOP_PAD + maxLevel.value * (NODE_H + 6) + 30);

function nodeX(idx: number) {
  return LEFT_PAD + (idx + 1) * (NODE_W + GAP);
}
function levelY(level: number) {
  return TOP_PAD + (maxLevel.value - level) * (NODE_H + 6);
}

function isHighlighted(nodeIdx: number, level: number) {
  return highlightPath.value.some(h => h.nodeIdx === nodeIdx && h.level === level);
}

async function insert(val?: number) {
  const v = val ?? Math.floor(Math.random() * 99) + 1;
  if (nodes.value.some(n => n.val === v)) {
    message.value = t(`${v} already exists — try again`, `${v} 已存在 — 请重试`);
    return;
  }
  const levels = randomLevel();
  const newNode: SkipNode = { val: v, levels };

  const insertIdx = nodes.value.findIndex(n => n.val > v);
  if (insertIdx === -1) {
    nodes.value.push(newNode);
  } else {
    nodes.value.splice(insertIdx, 0, newNode);
  }

  const actualIdx = insertIdx === -1 ? nodes.value.length - 1 : insertIdx;
  highlightPath.value = [{ nodeIdx: actualIdx, level: 0 }];
  message.value = t(
    `Inserted ${v} with ${levels} level${levels > 1 ? 's' : ''}. Higher levels = express lanes that skip over nodes for O(log n) search.`,
    `已插入 ${v}，${levels} 层。高层 = 快速通道，跳过节点实现 O(log n) 搜索。`
  );
  await delay(500);
  if (isAborted()) return;
  highlightPath.value = [];
}

async function search(target?: number) {
  if (nodes.value.length === 0) {
    message.value = t('Skip list is empty!', 'Skip List 为空！');
    return;
  }
  const tgt = target ?? nodes.value[Math.floor(Math.random() * nodes.value.length)].val;
  searchTarget.value = tgt;
  highlightPath.value = [];
  message.value = t(
    `Searching for ${tgt}... start at top level and move right, drop down when value exceeds target.`,
    `正在搜索 ${tgt}... 从最高层开始向右移动，当值超过目标时下降到下一层。`
  );

  let stepsCount = 0;
  let currentLevel = maxLevel.value - 1;
  let currentIdx = -1;

  while (currentLevel >= 0) {
    let nextIdx = currentIdx + 1;
    while (nextIdx < nodes.value.length) {
      if (nodes.value[nextIdx].levels > currentLevel) {
        if (nodes.value[nextIdx].val <= tgt) {
          stepsCount++;
          highlightPath.value = [...highlightPath.value, { nodeIdx: nextIdx, level: currentLevel }];
          message.value = t(
            `L${currentLevel}: visit ${nodes.value[nextIdx].val} (step ${stepsCount}). ${nodes.value[nextIdx].val === tgt ? 'Found!' : nodes.value[nextIdx].val < tgt ? 'Move right →' : 'Too far, drop down ↓'}`,
            `L${currentLevel}: 访问 ${nodes.value[nextIdx].val}（步骤 ${stepsCount}）。${nodes.value[nextIdx].val === tgt ? '找到了！' : nodes.value[nextIdx].val < tgt ? '继续右移 →' : '超过目标，下降 ↓'}`
          );
          await delay(400);
          if (isAborted()) return;
          if (nodes.value[nextIdx].val === tgt) {
            message.value = t(
              `Found ${tgt} in ${stepsCount} steps! A sorted array would need O(n) linear scan. Skip list: O(log n) on average.`,
              `在 ${stepsCount} 步中找到 ${tgt}！有序数组需要 O(n) 线性扫描。Skip List：平均 O(log n)。`
            );
            searchTarget.value = null;
            await delay(800);
            if (isAborted()) return;
            highlightPath.value = [];
            return;
          }
          currentIdx = nextIdx;
          nextIdx++;
        } else {
          break;
        }
      } else {
        nextIdx++;
      }
    }
    if (currentLevel > 0) {
      message.value = t(
        `L${currentLevel}: can't go further right → drop to L${currentLevel - 1}. This "drop down" is what makes skip lists fast.`,
        `L${currentLevel}: 无法继续右移 → 下降到 L${currentLevel - 1}。"下降"是 Skip List 快速的关键。`
      );
      await delay(300);
      if (isAborted()) return;
    }
    currentLevel--;
  }
  message.value = t(`${tgt} not found after ${stepsCount} steps`, `${stepsCount} 步后未找到 ${tgt}`);
  searchTarget.value = null;
  await delay(800);
  if (isAborted()) return;
  highlightPath.value = [];
}

function reset() {
  clearAll();
  nodes.value = [];
  highlightPath.value = [];
  searchTarget.value = null;
  presetRunning = false;
  message.value = t('Skip list cleared!', 'Skip List 已清空！');
}

async function presetBuildAndSearch() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const vals = [10, 30, 50, 20, 40, 60, 15, 45];
  for (const v of vals) {
    if (!presetRunning || isAborted()) return;
    await insert(v);
    await delay(300);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Skip list built! Now searching — watch how higher levels let us skip over many nodes at once.',
    'Skip List 已构建！现在搜索 — 观察高层如何让我们一次跳过多个节点。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  await search(45);
  if (!presetRunning || isAborted()) return;
  await delay(600);
  if (!presetRunning || isAborted()) return;
  await search(15);
  message.value = t(
    'Redis sorted sets use skip lists instead of balanced BSTs. Why? Simpler implementation, comparable performance, and range queries are natural.',
    'Redis 有序集合使用 Skip List 而非平衡 BST。为什么？实现更简单，性能相当，范围查询天然支持。'
  );
  presetRunning = false;
}

async function presetLevelTraversal() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const vals = [5, 15, 25, 35, 45, 55, 65, 75];
  for (const v of vals) {
    if (!presetRunning || isAborted()) return;
    await insert(v);
    await delay(200);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Notice the level distribution: ~50% have 1 level, ~25% have 2, ~12.5% have 3... This geometric distribution creates the O(log n) structure automatically — no rebalancing needed!',
    '注意层级分布：约 50% 有 1 层，约 25% 有 2 层，约 12.5% 有 3 层... 这种几何分布自动创建 O(log n) 结构 — 无需重新平衡！'
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Skip List', '交互式 Skip List') }}</div>

    <svg :viewBox="`0 0 ${svgW} ${svgH}`" class="skiplist-svg">
      <!-- Level labels -->
      <text
        v-for="lvl in maxLevel"
        :key="'label-' + lvl"
        :x="12"
        :y="levelY(lvl - 1) + NODE_H / 2"
        text-anchor="middle"
        dominant-baseline="central"
        fill="var(--viz-muted)"
        font-size="10"
        font-family="var(--vp-font-family-mono)"
      >L{{ lvl - 1 }}</text>

      <!-- HEAD column -->
      <g v-for="lvl in maxLevel" :key="'head-' + lvl">
        <rect
          :x="LEFT_PAD - NODE_W / 2"
          :y="levelY(lvl - 1)"
          :width="NODE_W"
          :height="NODE_H"
          rx="3"
          fill="var(--viz-muted)"
          opacity="0.3"
        />
        <text
          :x="LEFT_PAD"
          :y="levelY(lvl - 1) + NODE_H / 2"
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--viz-text)"
          font-size="9"
          font-family="var(--vp-font-family-mono)"
        >HD</text>
      </g>

      <!-- Nodes -->
      <g v-for="(node, i) in nodes" :key="'node-' + i">
        <g v-for="lvl in node.levels" :key="'cell-' + i + '-' + lvl">
          <rect
            :x="nodeX(i) - NODE_W / 2"
            :y="levelY(lvl - 1)"
            :width="NODE_W"
            :height="NODE_H"
            rx="3"
            :fill="isHighlighted(i, lvl - 1) ? 'var(--viz-warning)' : 'var(--viz-primary)'"
            stroke="var(--viz-border)"
            stroke-width="1"
            :class="{ 'skip-node-pulse': isHighlighted(i, lvl - 1) }"
          />
          <text
            :x="nodeX(i)"
            :y="levelY(lvl - 1) + NODE_H / 2"
            text-anchor="middle"
            dominant-baseline="central"
            fill="#fff"
            font-size="11"
            font-weight="700"
            font-family="var(--vp-font-family-mono)"
          >{{ node.val }}</text>
        </g>

        <!-- Vertical connectors between levels -->
        <line
          v-for="lvl in (node.levels - 1)"
          :key="'vert-' + i + '-' + lvl"
          :x1="nodeX(i)"
          :y1="levelY(lvl - 1) + NODE_H"
          :x2="nodeX(i)"
          :y2="levelY(lvl)"
          stroke="var(--viz-border)"
          stroke-width="1"
          stroke-dasharray="2,2"
        />
      </g>

      <!-- Horizontal arrows at each level -->
      <g v-for="lvl in maxLevel" :key="'arrows-' + lvl">
        <!-- HEAD to first node at this level -->
        <line
          v-if="nodes.some(n => n.levels >= lvl)"
          :x1="LEFT_PAD + NODE_W / 2"
          :y1="levelY(lvl - 1) + NODE_H / 2"
          :x2="nodeX(nodes.findIndex(n => n.levels >= lvl)) - NODE_W / 2"
          :y2="levelY(lvl - 1) + NODE_H / 2"
          stroke="var(--viz-border)"
          stroke-width="1"
          marker-end="url(#arrowhead)"
        />
        <!-- Between nodes at this level -->
        <template v-for="(node, i) in nodes" :key="'harrow-' + i + '-' + lvl">
          <line
            v-if="node.levels >= lvl && nodes.slice(i + 1).some(n => n.levels >= lvl)"
            :x1="nodeX(i) + NODE_W / 2"
            :y1="levelY(lvl - 1) + NODE_H / 2"
            :x2="nodeX(i + 1 + nodes.slice(i + 1).findIndex(n => n.levels >= lvl)) - NODE_W / 2"
            :y2="levelY(lvl - 1) + NODE_H / 2"
            stroke="var(--viz-border)"
            stroke-width="1"
            marker-end="url(#arrowhead)"
          />
        </template>
      </g>

      <!-- Arrow marker -->
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="var(--viz-border)" />
        </marker>
      </defs>

      <!-- Empty state -->
      <text v-if="nodes.length === 0" :x="svgW / 2" :y="svgH / 2" text-anchor="middle" fill="var(--viz-muted)" font-size="13">
        {{ t('Empty — click Insert or pick a scenario', '空 — 点击插入或选择一个场景') }}
      </text>
    </svg>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="insert()">{{ t('Insert Random', '插入随机值') }}</button>
      <button class="viz-btn" @click="search()">{{ t('Search Random', '搜索随机值') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetBuildAndSearch">{{ t('Build & Search', '构建搜索') }}</button>
      <button class="viz-btn" @click="presetLevelTraversal">{{ t('Level Distribution', '层级分布') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.skiplist-svg {
  width: 100%;
  max-width: 600px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 100px;
  overflow-x: auto;
}

.skip-node-pulse {
  animation: viz-pulse 0.3s ease;
}
</style>
