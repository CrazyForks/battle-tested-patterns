<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, safeTimeout, clearAll, speed, isAborted } = useVizTimers();

const BIT_COUNT = 16;
const HASH_COUNT = 3;

const bits = reactive<boolean[]>(Array(BIT_COUNT).fill(false));
const items = ref<string[]>([]);
const message = ref(t(
  'Add items to the Bloom filter, then test membership — or pick a scenario to see false positives in action',
  '向 Bloom Filter 添加元素，然后测试成员关系 — 或选择场景观看假阳性演示'
));
const highlightBits = ref<number[]>([]);
const highlightType = ref<'add' | 'hit' | 'miss' | 'false-positive' | ''>('');
const inputText = ref('');
let presetRunning = false;

const fillRate = computed(() => bits.filter(Boolean).length / BIT_COUNT);

function hash(str: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return ((h % BIT_COUNT) + BIT_COUNT) % BIT_COUNT;
}

function getHashes(str: string): number[] {
  return Array.from({ length: HASH_COUNT }, (_, i) => hash(str, (i + 1) * 31));
}

function add(item?: string) {
  const val = (item ?? inputText.value.trim()).toLowerCase();
  if (!val) { message.value = t('Enter a value first', '请先输入一个值'); return; }

  const hashes = getHashes(val);
  hashes.forEach(h => { bits[h] = true; });
  if (!items.value.includes(val)) items.value.push(val);

  highlightBits.value = hashes;
  highlightType.value = 'add';
  const fill = Math.round(fillRate.value * 100);
  message.value = t(
    `Added "${val}" → bits [${hashes.join(', ')}] set to 1. Fill rate: ${fill}% — higher fill = more false positives.`,
    `已添加 "${val}" → 位 [${hashes.join(', ')}] 置 1。填充率：${fill}% — 填充率越高，假阳性越多。`
  );
  inputText.value = '';
  safeTimeout(() => { highlightBits.value = []; highlightType.value = ''; }, 600);
}

function test(item?: string) {
  const val = (item ?? inputText.value.trim()).toLowerCase();
  if (!val) { message.value = t('Enter a value to test', '请输入要测试的值'); return; }

  const hashes = getHashes(val);
  const allSet = hashes.every(h => bits[h]);
  const actuallyExists = items.value.includes(val);

  highlightBits.value = hashes;

  if (allSet && actuallyExists) {
    highlightType.value = 'hit';
    message.value = t(
      `"${val}" → TRUE POSITIVE. All bits [${hashes.join(', ')}] are 1 and "${val}" was added. This is the "probably yes" answer.`,
      `"${val}" → 真阳性。位 [${hashes.join(', ')}] 均为 1 且 "${val}" 已添加。这是"可能存在"的回答。`
    );
  } else if (allSet && !actuallyExists) {
    highlightType.value = 'false-positive';
    message.value = t(
      `"${val}" → FALSE POSITIVE! Bits [${hashes.join(', ')}] are all 1, but "${val}" was never added! Other items' bits overlap — this is the fundamental trade-off of Bloom filters.`,
      `"${val}" → 假阳性！位 [${hashes.join(', ')}] 均为 1，但 "${val}" 从未被添加！其他元素的位重叠 — 这是 Bloom Filter 的根本权衡。`
    );
  } else {
    const zeroBits = hashes.filter(h => !bits[h]);
    highlightType.value = 'miss';
    message.value = t(
      `"${val}" → DEFINITELY NOT in set. Bit${zeroBits.length > 1 ? 's' : ''} [${zeroBits.join(', ')}] ${zeroBits.length > 1 ? 'are' : 'is'} 0. Bloom filters never have false negatives — if any bit is 0, the item was never added.`,
      `"${val}" → 确定不在集合中。位 [${zeroBits.join(', ')}] 为 0。Bloom Filter 永远不会有假阴性 — 只要有一位为 0，该元素就一定未被添加。`
    );
  }
  inputText.value = '';
  safeTimeout(() => { highlightBits.value = []; highlightType.value = ''; }, 800);
}

function reset() {
  clearAll();
  bits.fill(false);
  items.value = [];
  highlightBits.value = [];
  highlightType.value = '';
  presetRunning = false;
  message.value = t('Filter cleared!', '过滤器已清空！');
}

async function presetUrlDedup() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const urls = ['google', 'github', 'reddit', 'twitter', 'github'];
  for (const url of urls) {
    if (!presetRunning || isAborted()) return;
    if (url === urls[4]) {
      test(url);
      message.value = t(
        `Duplicate check: "${url}" is already in filter — skip crawling! This is how web crawlers avoid re-visiting URLs (Google uses Bloom filters at scale).`,
        `重复检查："${url}" 已在过滤器中 — 跳过爬取！这就是网络爬虫避免重复访问 URL 的方式（Google 大规模使用 Bloom Filter）。`
      );
    } else {
      add(url);
    }
    await delay(800);
    if (!presetRunning || isAborted()) return;
  }
  presetRunning = false;
}

async function presetFalsePositive() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const addItems = ['cat', 'dog', 'bird'];
  for (const item of addItems) {
    if (!presetRunning || isAborted()) return;
    add(item);
    await delay(700);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Now testing items that were NEVER added — watch for false positives...',
    '现在测试从未添加的元素 — 注意观察假阳性...'
  );
  await delay(900);
  const testItems = ['rat', 'fox', 'ant', 'cow'];
  for (const item of testItems) {
    if (!presetRunning || isAborted()) return;
    test(item);
    await delay(1000);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Notice: some items show false positives because their hash bits overlap with added items. The formula: P(fp) ≈ (1 - e^(-kn/m))^k.',
    '注意：某些元素显示假阳性，因为它们的哈希位与已添加元素重叠。公式：P(fp) ≈ (1 - e^(-kn/m))^k。'
  );
  presetRunning = false;
}

async function presetCapacityLimit() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const addItems = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (const item of addItems) {
    if (!presetRunning || isAborted()) return;
    add(item);
    await delay(600);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    `Fill rate: ${Math.round(fillRate.value * 100)}%! At high fill rates, almost every test returns "probably yes." This is why you must size Bloom filters for your expected dataset — undersizing destroys usefulness.`,
    `填充率：${Math.round(fillRate.value * 100)}%！在高填充率下，几乎每次测试都返回"可能存在"。这就是为什么必须根据预期数据集大小调整 Bloom Filter — 尺寸不足会使其失去价值。`
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  const testItems = ['x', 'y', 'z'];
  for (const item of testItems) {
    if (!presetRunning || isAborted()) return;
    test(item);
    await delay(900);
    if (!presetRunning || isAborted()) return;
  }
  presetRunning = false;
}

const presetTests = ['cat', 'rat', 'fox', 'ant'];
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Bloom Filter', '交互式 Bloom Filter') }} · {{ BIT_COUNT }} {{ t('bits', '位') }} · {{ HASH_COUNT }} {{ t('hash functions', '个哈希函数') }}</div>

    <!-- Bit array -->
    <div class="bloom-bits">
      <div
        v-for="(bit, i) in bits"
        :key="i"
        class="bloom-bit"
        :class="{
          'bloom-bit--set': bit,
          'bloom-bit--highlight-add': highlightBits.includes(i) && highlightType === 'add',
          'bloom-bit--highlight-hit': highlightBits.includes(i) && (highlightType === 'hit' || highlightType === 'false-positive'),
          'bloom-bit--highlight-miss': highlightBits.includes(i) && highlightType === 'miss',
        }"
      >
        <span class="bloom-bit-val">{{ bit ? '1' : '0' }}</span>
        <span class="bloom-bit-idx">{{ i }}</span>
      </div>
    </div>

    <!-- Fill rate bar -->
    <div class="bloom-fill">
      <div class="bloom-fill-bar" :style="{ width: (fillRate * 100) + '%', background: fillRate > 0.7 ? 'var(--viz-danger)' : fillRate > 0.4 ? 'var(--viz-warning)' : 'var(--viz-success)' }"></div>
      <span class="bloom-fill-label">{{ Math.round(fillRate * 100) }}% {{ t('filled', '已填充') }}</span>
    </div>

    <!-- Added items -->
    <div v-if="items.length" class="bloom-items">
      <span class="bloom-items-label">{{ t('In filter:', '已添加：') }}</span>
      <span v-for="item in items" :key="item" class="bloom-tag">{{ item }}</span>
    </div>

    <!-- Controls -->
    <div class="bloom-control-row">
      <input v-model="inputText" class="bloom-input" :placeholder="t('Enter value...', '输入值...')" @keyup.enter="add()" />
      <div class="viz-controls" style="margin-top: 0">
        <button class="viz-btn viz-btn--primary" @click="add()">{{ t('Add', '添加') }}</button>
        <button class="viz-btn" @click="test()">{{ t('Test', '测试') }}</button>
        <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
        <div class="viz-speed">
          <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
          <span class="viz-speed-val">{{ speed }}x</span>
        </div>
      </div>
    </div>

    <div class="bloom-presets">
      <span class="viz-label">{{ t('Quick test:', '快速测试：') }}&nbsp;</span>
      <button v-for="pt in presetTests" :key="pt" class="bloom-preset-btn" @click="test(pt)">test("{{ pt }}")</button>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetUrlDedup">{{ t('URL Dedup', 'URL 去重') }}</button>
      <button class="viz-btn" @click="presetFalsePositive">{{ t('False Positive Demo', '假阳性演示') }}</button>
      <button class="viz-btn" @click="presetCapacityLimit">{{ t('Capacity Limit', '容量极限') }}</button>
    </div>

    <div class="viz-status" :class="{
      'viz-status--hit': highlightType === 'hit',
      'viz-status--miss': highlightType === 'miss',
      'viz-status--fp': highlightType === 'false-positive',
      'viz-status--add': highlightType === 'add',
    }">{{ message }}</div>
  </div>
</template>

<style scoped>
.bloom-bits {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 0.75rem 0;
}

.bloom-bit {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 36px;
  height: 44px;
  border: 1.5px solid var(--viz-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  transition: all 0.3s ease;
}

.bloom-bit--set {
  background: var(--viz-primary);
  border-color: var(--viz-primary);
}

.bloom-bit--set .bloom-bit-val { color: #fff; }
.bloom-bit--set .bloom-bit-idx { color: rgba(255,255,255,0.6); }

.bloom-bit--highlight-add {
  animation: viz-pulse 0.6s ease;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
}

.bloom-bit--highlight-hit {
  animation: viz-pulse 0.6s ease;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
  border-color: var(--viz-success) !important;
}

.bloom-bit--highlight-miss {
  animation: viz-pulse 0.6s ease;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
  border-color: var(--viz-danger) !important;
}

.bloom-bit-val {
  font-size: 0.875rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  line-height: 28px;
}

.bloom-bit-idx {
  font-size: 0.5625rem;
  color: var(--viz-muted);
}

.bloom-fill {
  position: relative;
  height: 14px;
  background: var(--viz-bg);
  border: 1px solid var(--viz-border);
  border-radius: 7px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.bloom-fill-bar {
  height: 100%;
  border-radius: 7px;
  transition: all 0.3s ease;
}

.bloom-fill-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.bloom-items {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  padding: 0.375rem 0;
}

.bloom-items-label {
  font-size: 0.75rem;
  color: var(--viz-muted);
}

.bloom-tag {
  padding: 0.125rem 0.5rem;
  border-radius: 99px;
  background: var(--viz-primary);
  color: #fff;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
}

.bloom-control-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.bloom-input {
  width: 140px;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.bloom-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

.bloom-presets {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.bloom-preset-btn {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 4px;
  background: transparent;
  color: var(--viz-muted);
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  cursor: pointer;
  transition: all 0.15s ease;
}

.bloom-preset-btn:hover {
  color: var(--viz-primary);
  border-color: var(--viz-primary);
}

.viz-status--fp { border-left: 3px solid var(--viz-warning); }
.viz-status--add { border-left: 3px solid var(--viz-primary); }
</style>
