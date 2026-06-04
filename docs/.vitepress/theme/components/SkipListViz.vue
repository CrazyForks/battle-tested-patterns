<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

interface SkipNode {
  val: number;
  levels: number;
}

const nodes = ref<SkipNode[]>([]);
const message = ref(t('Insert values to build a skip list', '插入值来构建 Skip List'));
const highlightPath = ref<{ nodeIdx: number; level: number }[]>([]);
const searchTarget = ref<number | null>(null);

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

async function insert() {
  const val = Math.floor(Math.random() * 99) + 1;
  if (nodes.value.some(n => n.val === val)) {
    message.value = t(`${val} already exists — try again`, `${val} 已存在 — 请重试`);
    return;
  }
  const levels = randomLevel();
  const newNode: SkipNode = { val, levels };

  const insertIdx = nodes.value.findIndex(n => n.val > val);
  if (insertIdx === -1) {
    nodes.value.push(newNode);
  } else {
    nodes.value.splice(insertIdx, 0, newNode);
  }

  highlightPath.value = [{ nodeIdx: insertIdx === -1 ? nodes.value.length - 1 : insertIdx, level: 0 }];
  message.value = t(`Inserted ${val} with ${levels} level${levels > 1 ? 's' : ''}`, `已插入 ${val}，${levels} 层`);
  await delay(500);
  highlightPath.value = [];
}

async function search() {
  if (nodes.value.length === 0) {
    message.value = t('Skip list is empty!', 'Skip List 为空！');
    return;
  }
  const target = nodes.value[Math.floor(Math.random() * nodes.value.length)].val;
  searchTarget.value = target;
  highlightPath.value = [];
  message.value = t(`Searching for ${target}...`, `正在搜索 ${target}...`);

  let currentLevel = maxLevel.value - 1;
  let currentIdx = -1;

  while (currentLevel >= 0) {
    let nextIdx = currentIdx + 1;
    while (nextIdx < nodes.value.length) {
      if (nodes.value[nextIdx].levels > currentLevel) {
        if (nodes.value[nextIdx].val <= target) {
          highlightPath.value = [...highlightPath.value, { nodeIdx: nextIdx, level: currentLevel }];
          await delay(300);
          if (nodes.value[nextIdx].val === target) {
            message.value = t(`Found ${target} at index ${nextIdx}!`, `找到 ${target}，索引 ${nextIdx}！`);
            searchTarget.value = null;
            await delay(800);
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
    currentLevel--;
  }
  message.value = t(`${target} not found`, `未找到 ${target}`);
  searchTarget.value = null;
  await delay(800);
  highlightPath.value = [];
}

function reset() {
  nodes.value = [];
  highlightPath.value = [];
  searchTarget.value = null;
  message.value = t('Skip list cleared!', 'Skip List 已清空！');
}

let aborted = false;
onUnmounted(() => { aborted = true; });

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
        {{ t('Empty — click Insert to add values', '空 — 点击插入来添加值') }}
      </text>
    </svg>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="insert">{{ t('Insert Random', '插入随机值') }}</button>
      <button class="viz-btn" @click="search">{{ t('Search Random', '搜索随机值') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
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
  animation: skip-pulse 0.3s ease;
}

@keyframes skip-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
