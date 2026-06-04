<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const leaves = ref<string[]>(['A', 'B', 'C', 'D']);
const highlightPath = ref<Set<number>>(new Set());
const tampered = ref<number | null>(null);
const message = ref(t('A Merkle tree of 4 data blocks — click Verify or Tamper', '4 个数据块的 Merkle Tree - 点击验证或篡改'));

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 6).padStart(6, '0');
}

const tree = computed(() => {
  const hashes: string[] = [];
  // Level 0: leaf hashes (indices 3,4,5,6 in a 7-node tree)
  const leafHashes = leaves.value.map(d => simpleHash(d));

  // Build bottom-up: store in array where index 0 = root
  // For 4 leaves: nodes[3..6] = leaves, nodes[1..2] = internal, nodes[0] = root
  const n = 7; // 2^3 - 1 for 4 leaves
  const nodes: string[] = new Array(n).fill('');

  nodes[3] = leafHashes[0];
  nodes[4] = leafHashes[1];
  nodes[5] = leafHashes[2];
  nodes[6] = leafHashes[3];

  nodes[1] = simpleHash(nodes[3] + nodes[4]);
  nodes[2] = simpleHash(nodes[5] + nodes[6]);
  nodes[0] = simpleHash(nodes[1] + nodes[2]);

  return nodes;
});

const positions: { x: number; y: number }[] = [
  { x: 200, y: 30 },   // 0: root
  { x: 110, y: 100 },  // 1: H12
  { x: 290, y: 100 },  // 2: H34
  { x: 65, y: 170 },   // 3: H1
  { x: 155, y: 170 },  // 4: H2
  { x: 245, y: 170 },  // 5: H3
  { x: 335, y: 170 },  // 6: H4
];

const edges = [
  [0, 1], [0, 2],
  [1, 3], [1, 4],
  [2, 5], [2, 6],
];

const labels = computed(() => [
  'Root',
  'H12',
  'H34',
  `H(${leaves.value[0]})`,
  `H(${leaves.value[1]})`,
  `H(${leaves.value[2]})`,
  `H(${leaves.value[3]})`,
]);

let aborted = false;
onUnmounted(() => { aborted = true; });

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyLeaf(leafIdx: number) {
  highlightPath.value = new Set();
  tampered.value = null;
  const treeIdx = leafIdx + 3;
  message.value = t(`Verifying Data ${leaves.value[leafIdx]}...`, `正在验证数据 ${leaves.value[leafIdx]}...`);

  // Highlight the leaf
  highlightPath.value = new Set([treeIdx]);
  await delay(400);
  if (aborted) return;

  // Highlight sibling
  const sibling = treeIdx % 2 === 0 ? treeIdx - 1 : treeIdx + 1;
  highlightPath.value = new Set([treeIdx, sibling]);
  await delay(400);
  if (aborted) return;

  // Highlight parent
  const parent = treeIdx <= 4 ? 1 : 2;
  highlightPath.value = new Set([treeIdx, sibling, parent]);
  await delay(400);
  if (aborted) return;

  // Highlight uncle and root
  const uncle = parent === 1 ? 2 : 1;
  highlightPath.value = new Set([treeIdx, sibling, parent, uncle, 0]);
  await delay(400);
  if (aborted) return;

  message.value = t(`Verified: root hash matches — Data ${leaves.value[leafIdx]} is intact`, `验证通过：根哈希匹配 - 数据 ${leaves.value[leafIdx]} 完整`);
  await delay(1200);
  if (aborted) return;
  highlightPath.value = new Set();
}

async function tamperLeaf() {
  highlightPath.value = new Set();
  const idx = Math.floor(Math.random() * 4);
  const original = leaves.value[idx];
  leaves.value[idx] = original + '!';
  tampered.value = idx + 3;
  message.value = t(`Tampered Data ${original} → ${leaves.value[idx]} — root hash changed!`, `篡改数据 ${original} → ${leaves.value[idx]} - 根哈希已改变！`);
}

function reset() {
  leaves.value = ['A', 'B', 'C', 'D'];
  highlightPath.value = new Set();
  tampered.value = null;
  message.value = t('Merkle tree reset', 'Merkle Tree 已重置');
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Merkle Tree', '交互式 Merkle Tree') }}</div>

    <svg viewBox="0 0 400 230" class="merkle-svg">
      <!-- Edges -->
      <line
        v-for="[from, to] in edges"
        :key="`${from}-${to}`"
        :x1="positions[from].x"
        :y1="positions[from].y"
        :x2="positions[to].x"
        :y2="positions[to].y"
        stroke="var(--viz-border)"
        stroke-width="1.5"
      />

      <!-- Nodes -->
      <g v-for="(pos, i) in positions" :key="i" :transform="`translate(${pos.x}, ${pos.y})`">
        <rect
          x="-30" y="-14"
          width="60" height="28"
          rx="6"
          :fill="tampered === i ? 'var(--viz-danger)' :
                 highlightPath.has(i) ? 'var(--viz-warning)' :
                 i >= 3 ? 'var(--viz-primary)' : 'var(--viz-muted)'"
          :class="{ 'merkle-pulse': highlightPath.has(i) }"
        />
        <text
          text-anchor="middle"
          dominant-baseline="central"
          fill="#fff"
          font-size="9"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >{{ tree[i].slice(0, 6) }}</text>
        <text
          :y="-20"
          text-anchor="middle"
          fill="var(--viz-muted)"
          font-size="8"
          font-family="var(--vp-font-family-mono)"
        >{{ labels[i] }}</text>
      </g>
    </svg>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="verifyLeaf(0)">{{ t('Verify A', '验证 A') }}</button>
      <button class="viz-btn viz-btn--primary" @click="verifyLeaf(2)">{{ t('Verify C', '验证 C') }}</button>
      <button class="viz-btn viz-btn--danger" @click="tamperLeaf">{{ t('Tamper!', '篡改！') }}</button>
      <button class="viz-btn" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.merkle-svg {
  width: 100%;
  max-width: 420px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 160px;
}

.merkle-pulse {
  animation: merkle-glow 0.4s ease;
}

@keyframes merkle-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
