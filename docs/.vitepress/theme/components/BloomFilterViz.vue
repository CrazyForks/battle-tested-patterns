<script setup lang="ts">
import { ref, reactive, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const BIT_COUNT = 16;
const HASH_COUNT = 3;

const bits = reactive<boolean[]>(Array(BIT_COUNT).fill(false));
const items = ref<string[]>([]);
const message = ref(t('Add items to the Bloom filter, then test membership', '向 Bloom Filter 添加元素，然后测试成员关系'));
const highlightBits = ref<number[]>([]);
const highlightType = ref<'add' | 'hit' | 'miss' | 'false-positive' | ''>('');
const inputText = ref('');
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

onUnmounted(() => {
  for (const t of pendingTimers) clearTimeout(t);
  pendingTimers.clear();
});

function scheduleTimeout(fn: () => void, ms: number) {
  const id = setTimeout(() => { pendingTimers.delete(id); fn(); }, ms);
  pendingTimers.add(id);
}

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
  message.value = t(`Added "${val}" → set bits [${hashes.join(', ')}]`, `已添加 "${val}" → 设置位 [${hashes.join(', ')}]`);
  inputText.value = '';
  scheduleTimeout(() => { highlightBits.value = []; highlightType.value = ''; }, 600);
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
    message.value = t(`"${val}" → Probably in set (true positive) ✓ bits [${hashes.join(', ')}] all set`, `"${val}" → 可能在集合中（真阳性）✓ 位 [${hashes.join(', ')}] 均已设置`);
  } else if (allSet && !actuallyExists) {
    highlightType.value = 'false-positive';
    message.value = t(`"${val}" → FALSE POSITIVE! bits [${hashes.join(', ')}] all set, but "${val}" was never added!`, `"${val}" → 假阳性！位 [${hashes.join(', ')}] 均已设置，但 "${val}" 从未被添加！`);
  } else {
    const zeroBits = hashes.filter(h => !bits[h]);
    highlightType.value = 'miss';
    message.value = t(`"${val}" → Definitely NOT in set. bits [${zeroBits.join(', ')}] are 0`, `"${val}" → 确定不在集合中。位 [${zeroBits.join(', ')}] 为 0`);
  }
  inputText.value = '';
  scheduleTimeout(() => { highlightBits.value = []; highlightType.value = ''; }, 800);
}

function reset() {
  bits.fill(false);
  items.value = [];
  highlightBits.value = [];
  highlightType.value = '';
  message.value = t('Filter cleared!', '过滤器已清空！');
}

function demo() {
  reset();
  scheduleTimeout(() => add('cat'), 100);
  scheduleTimeout(() => add('dog'), 500);
  scheduleTimeout(() => add('bird'), 900);
  scheduleTimeout(() => {
    message.value = t('Now try: test("cat") = true positive, test("rat") = false positive!', '现在试试：test("cat") = 真阳性，test("rat") = 假阳性！');
  }, 1300);
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
        <button class="viz-btn" @click="demo">{{ t('Demo', '演示') }}</button>
        <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      </div>
    </div>

    <div class="bloom-presets">
      <span class="viz-label">{{ t('Quick test:', '快速测试：') }}&nbsp;</span>
      <button v-for="pt in presetTests" :key="pt" class="bloom-preset-btn" @click="test(pt)">test("{{ pt }}")</button>
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
  animation: bit-pulse-blue 0.6s ease;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
}

.bloom-bit--highlight-hit {
  animation: bit-pulse-green 0.6s ease;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
  border-color: var(--viz-success) !important;
}

.bloom-bit--highlight-miss {
  animation: bit-pulse-red 0.6s ease;
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

@keyframes bit-pulse-blue {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

@keyframes bit-pulse-green {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

@keyframes bit-pulse-red {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
