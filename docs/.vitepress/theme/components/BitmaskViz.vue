<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();
const LABELS = ['READ', 'WRITE', 'EXEC', 'ADMIN', 'LOG', 'NET', 'GPU', 'IO'];
const bits = ref(0);
const message = ref(t('Toggle bits to build a permission mask', '切换位来构建权限掩码'));
function toggle(idx: number) {
  bits.value ^= (1 << idx);
  const label = LABELS[idx];
  const on = (bits.value >> idx) & 1;
  message.value = t(
    `${label} ${on ? 'ON' : 'OFF'} — mask is now 0b${bits.value.toString(2).padStart(8, '0')} (${bits.value})`,
    `${label} ${on ? '开启' : '关闭'} — 掩码现为 0b${bits.value.toString(2).padStart(8, '0')} (${bits.value})`
  );
}

function setAll() {
  bits.value = 0xFF;
  message.value = t('All flags set — mask = 0xFF (255)', '所有标志已设置 — 掩码 = 0xFF (255)');
}

function clearAll() {
  bits.value = 0;
  message.value = t('All flags cleared — mask = 0x00 (0)', '所有标志已清除 — 掩码 = 0x00 (0)');
}

const binaryStr = computed(() => bits.value.toString(2).padStart(8, '0'));
const hexStr = computed(() => '0x' + bits.value.toString(16).toUpperCase().padStart(2, '0'));

function testOp() {
  const a = bits.value;
  const b = 0b00000101; // READ | EXEC
  const andResult = a & b;
  const orResult = a | b;
  message.value = t(
    `mask & 0x05 = ${andResult} (${andResult.toString(2).padStart(8, '0')})  |  mask | 0x05 = ${orResult} (${orResult.toString(2).padStart(8, '0')})`,
    `掩码 & 0x05 = ${andResult} (${andResult.toString(2).padStart(8, '0')})  |  掩码 | 0x05 = ${orResult} (${orResult.toString(2).padStart(8, '0')})`
  );
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Bitmask', '交互式 Bitmask') }}</div>

    <div class="bm-display">
      <div class="bm-binary">
        <span
          v-for="(ch, i) in binaryStr.split('')"
          :key="i"
          class="bm-bit"
          :class="{ 'bm-bit-on': ch === '1' }"
          @click="toggle(7 - i)"
        >{{ ch }}</span>
      </div>
      <div class="bm-values">
        <span class="bm-val">dec: <strong>{{ bits }}</strong></span>
        <span class="bm-val">hex: <strong>{{ hexStr }}</strong></span>
      </div>
    </div>

    <div class="bm-flags">
      <button
        v-for="(label, i) in LABELS"
        :key="label"
        class="bm-flag"
        :class="{ 'bm-flag-on': (bits >> i) & 1 }"
        @click="toggle(i)"
      >
        <span class="bm-flag-bit">{{ (bits >> i) & 1 }}</span>
        <span class="bm-flag-label">{{ label }}</span>
      </button>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="testOp">{{ t('Test AND/OR with 0x05', '测试 AND/OR 与 0x05') }}</button>
      <button class="viz-btn" @click="setAll">{{ t('Set All', '全部设置') }}</button>
      <button class="viz-btn viz-btn--danger" @click="clearAll">{{ t('Clear All', '全部清除') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.bm-display {
  text-align: center;
  padding: 1rem 0;
}

.bm-binary {
  display: inline-flex;
  gap: 2px;
  margin-bottom: 0.5rem;
}

.bm-bit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 36px;
  font-size: 1.1rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  border: 2px solid var(--viz-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--viz-muted);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.bm-bit-on {
  background: var(--viz-primary);
  border-color: var(--viz-primary);
  color: #fff;
}

.bm-bit:hover {
  border-color: var(--viz-primary);
}

.bm-values {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
}

.bm-val {
  font-size: 0.8rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.bm-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0.5rem 0;
  justify-content: center;
}

.bm-flag {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.4rem 0.6rem;
  border: 2px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  cursor: pointer;
  transition: all 0.15s;
  min-width: 52px;
}

.bm-flag:hover {
  border-color: var(--viz-primary);
}

.bm-flag-on {
  border-color: var(--viz-success);
  background: var(--viz-success);
}

.bm-flag-on .bm-flag-label,
.bm-flag-on .bm-flag-bit {
  color: #fff;
}

.bm-flag-bit {
  font-size: 0.9rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.bm-flag-label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--viz-text);
}

@media (max-width: 640px) {
  .bm-bit {
    width: 28px;
    height: 32px;
    font-size: 0.95rem;
  }
  .bm-flag {
    min-width: 44px;
    padding: 0.3rem 0.4rem;
  }
}
</style>
