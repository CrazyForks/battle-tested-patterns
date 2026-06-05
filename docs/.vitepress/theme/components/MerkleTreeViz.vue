<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import VizLog from './VizLog.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const leaves = ref<string[]>(['A', 'B', 'C', 'D']);
const highlightPath = ref<Set<number>>(new Set());
const tampered = ref<number | null>(null);
const message = ref(t(
  'A Merkle tree of 4 data blocks — click Verify or Tamper. Used by Git, Bitcoin, and IPFS to detect data corruption in O(log n) time.',
  '4 个数据块的 Merkle Tree — 点击验证或篡改。Git、Bitcoin 和 IPFS 使用它在 O(log n) 时间内检测数据损坏。'
));
let presetRunning = false;

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).slice(0, 6).padStart(6, '0');
}

const tree = computed(() => {
  const n = 7;
  const nodes: string[] = new Array(n).fill('');
  const leafHashes = leaves.value.map(d => simpleHash(d));

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
  { x: 200, y: 30 },
  { x: 110, y: 100 },
  { x: 290, y: 100 },
  { x: 65, y: 170 },
  { x: 155, y: 170 },
  { x: 245, y: 170 },
  { x: 335, y: 170 },
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

async function verifyLeaf(leafIdx: number) {
  highlightPath.value = new Set();
  tampered.value = null;
  const treeIdx = leafIdx + 3;
  message.value = t(
    `Verifying Data ${leaves.value[leafIdx]}... Only need log₂(n) = 2 sibling hashes to verify any leaf.`,
    `正在验证数据 ${leaves.value[leafIdx]}... 验证任何叶子只需 log₂(n) = 2 个兄弟哈希。`
  );

  highlightPath.value = new Set([treeIdx]);
  await delay(400);
  if (isAborted()) return;

  const sibling = treeIdx % 2 === 0 ? treeIdx - 1 : treeIdx + 1;
  highlightPath.value = new Set([treeIdx, sibling]);
  await delay(400);
  if (isAborted()) return;

  const parent = treeIdx <= 4 ? 1 : 2;
  highlightPath.value = new Set([treeIdx, sibling, parent]);
  await delay(400);
  if (isAborted()) return;

  const uncle = parent === 1 ? 2 : 1;
  highlightPath.value = new Set([treeIdx, sibling, parent, uncle, 0]);
  await delay(400);
  if (isAborted()) return;

  message.value = t(
    `Verified: root hash matches — Data ${leaves.value[leafIdx]} is intact. This "Merkle proof" is how light clients verify Bitcoin transactions without downloading the full blockchain.`,
    `验证通过：根哈希匹配 — 数据 ${leaves.value[leafIdx]} 完整。这种"Merkle 证明"是轻客户端无需下载完整区块链即可验证 Bitcoin 交易的方式。`
  );
  log(message.value, 'success');
  await delay(1200);
  if (isAborted()) return;
  highlightPath.value = new Set();
}

async function tamperLeaf() {
  highlightPath.value = new Set();
  const idx = Math.floor(Math.random() * 4);
  const original = leaves.value[idx];
  leaves.value[idx] = original + '!';
  tampered.value = idx + 3;
  message.value = t(
    `Tampered Data ${original} → ${leaves.value[idx]} — root hash changed! Every node on the path to root is invalidated. This is how Git detects corrupted objects.`,
    `篡改数据 ${original} → ${leaves.value[idx]} — 根哈希已改变！到根的路径上每个节点都失效了。Git 就是这样检测损坏对象的。`
  );
  log(message.value, 'warning');
}

function reset() {
  clearAll();
  leaves.value = ['A', 'B', 'C', 'D'];
  highlightPath.value = new Set();
  tampered.value = null;
  presetRunning = false;
  message.value = t(
    'Merkle tree reset — verify leaves or tamper data',
    'Merkle Tree 已重置 — 验证叶子或篡改数据'
  );
  clearLog();
}

async function presetVerifyAll() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Verifying all 4 leaves one by one. Each verification walks leaf→root using O(log n) sibling hashes — this is the "Merkle proof" used by Ethereum, IPFS, and certificate transparency logs.',
    '逐一验证全部 4 个叶子。每次验证使用 O(log n) 个兄弟哈希从叶子走到根 — 这是 Ethereum、IPFS 和证书透明日志使用的"Merkle 证明"。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 4; i++) {
    if (!presetRunning || isAborted()) return;
    await verifyLeaf(i);
    await delay(400);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'All 4 leaves verified with only 2 hashes each. A tree with 1M leaves would still need only 20 hashes per proof — that is the power of Merkle trees.',
    '全部 4 个叶子验证完成，每个只需 2 个哈希。有 100 万叶子的树每个证明仍然只需 20 个哈希 — 这就是 Merkle 树的力量。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetTamperAndDetect() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Tamper detection demo: we will tamper a block, then verify it. The root hash mismatch instantly exposes the corruption — this is how S3, Azure Blob, and GCS verify data integrity.',
    '篡改检测演示：我们将篡改一个块，然后验证它。根哈希不匹配立即暴露损坏 — S3、Azure Blob 和 GCS 就是这样验证数据完整性的。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  const savedRoot = tree.value[0];
  tamperLeaf();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  await verifyLeaf(0);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    `Root hash changed from ${savedRoot.slice(0, 6)} to ${tree.value[0].slice(0, 6)} — tampering detected! In Git, this is like "git fsck" finding a corrupted commit.`,
    `根哈希从 ${savedRoot.slice(0, 6)} 变为 ${tree.value[0].slice(0, 6)} — 检测到篡改！在 Git 中，这就像 "git fsck" 发现损坏的提交。`
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetDiffSync() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Diff sync demo: compare two trees to find which blocks differ. By comparing internal nodes top-down, we skip entire subtrees that match — this is how rsync and anti-entropy protocols work.',
    '差异同步演示：比较两棵树找出不同的块。通过自顶向下比较内部节点，我们跳过匹配的整个子树 — rsync 和反熵协议就是这样工作的。'
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  highlightPath.value = new Set([0]);
  message.value = t('Step 1: Compare roots. They match? If not, drill down.', '步骤 1：比较根。匹配吗？不匹配则向下钻取。');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  leaves.value[2] = 'C!';
  tampered.value = 5;
  message.value = t('Block C changed → root hash changed. Compare children to narrow down.', 'Block C 改变 → 根哈希改变。比较子节点以缩小范围。');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  highlightPath.value = new Set([0, 1, 2]);
  message.value = t('Step 2: H12 matches old value, but H34 differs → difference is in right subtree.', '步骤 2：H12 匹配旧值，但 H34 不同 → 差异在右子树。');
  await delay(800);
  if (!presetRunning || isAborted()) return;
  highlightPath.value = new Set([0, 2, 5, 6]);
  message.value = t(
    'Step 3: H(C) differs, H(D) matches → only block C changed. Found the diff in O(log n) comparisons! Cassandra anti-entropy uses exactly this approach.',
    '步骤 3：H(C) 不同，H(D) 匹配 → 只有 Block C 改变。在 O(log n) 次比较中找到差异！Cassandra 反熵正是使用这种方法。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
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
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetVerifyAll">{{ t('Verify All', '验证全部') }}</button>
      <button class="viz-btn" @click="presetTamperAndDetect">{{ t('Tamper & Detect', '篡改检测') }}</button>
      <button class="viz-btn" @click="presetDiffSync">{{ t('Diff Sync', '差异同步') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
    <VizLog :entries="logEntries" @clear="clearLog" />
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
  animation: viz-pulse 0.4s ease;
}
</style>
