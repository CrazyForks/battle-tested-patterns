<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll: clearTimers, speed, isAborted } = useVizTimers();

const LABELS = ['READ', 'WRITE', 'EXEC', 'ADMIN', 'LOG', 'NET', 'GPU', 'IO'];
const bits = ref(0);
const message = ref(t(
  'Toggle bits to build a permission mask — each bit is a yes/no flag packed into a single integer',
  '切换位来构建权限掩码 — 每个位都是打包到单个整数中的是/否标志'
));
let presetRunning = false;

function toggle(idx: number) {
  bits.value ^= (1 << idx);
  const label = LABELS[idx];
  const on = (bits.value >> idx) & 1;
  message.value = t(
    `${label} ${on ? 'ON' : 'OFF'} — mask is now 0b${bits.value.toString(2).padStart(8, '0')} (${bits.value}). XOR (^) flips a single bit without touching others — O(1) set/clear.`,
    `${label} ${on ? '开启' : '关闭'} — 掩码现为 0b${bits.value.toString(2).padStart(8, '0')} (${bits.value})。XOR (^) 翻转单个位而不影响其他位 — O(1) 设置/清除。`
  );
}

function setAll() {
  bits.value = 0xFF;
  message.value = t(
    'All flags set — mask = 0xFF (255). One integer stores 8 booleans. Linux file permissions use exactly this: rwxrwxrwx = 9 bits in a single mode_t.',
    '所有标志已设置 — 掩码 = 0xFF (255)。一个整数存储 8 个布尔值。Linux 文件权限正是这样用的：rwxrwxrwx = 一个 mode_t 中的 9 位。'
  );
}

function clearAllBits() {
  bits.value = 0;
  message.value = t(
    'All flags cleared — mask = 0x00 (0). Assignment is O(1) — no need to iterate over individual flags.',
    '所有标志已清除 — 掩码 = 0x00 (0)。赋值是 O(1) — 不需要遍历各个标志。'
  );
}

const binaryStr = computed(() => bits.value.toString(2).padStart(8, '0'));
const hexStr = computed(() => '0x' + bits.value.toString(16).toUpperCase().padStart(2, '0'));

function testOp() {
  const a = bits.value;
  const b = 0b00000101; // READ | EXEC
  const andResult = a & b;
  const orResult = a | b;
  message.value = t(
    `AND masks out: mask & 0x05 = ${andResult} (${andResult.toString(2).padStart(8, '0')}). OR combines: mask | 0x05 = ${orResult} (${orResult.toString(2).padStart(8, '0')}). React uses this for fiber flags: PerformedWork | Placement.`,
    `AND 掩码过滤：掩码 & 0x05 = ${andResult} (${andResult.toString(2).padStart(8, '0')})。OR 组合：掩码 | 0x05 = ${orResult} (${orResult.toString(2).padStart(8, '0')})。React 将此用于 fiber 标志：PerformedWork | Placement。`
  );
}

async function presetUnixPerms() {
  if (presetRunning) return;
  clearTimers();
  presetRunning = true;
  bits.value = 0;
  message.value = t(
    'Unix permissions demo: READ + WRITE + EXEC = rwx for owner. Linux stores this as 3 bits per user/group/other — 9 bits total in one integer.',
    'Unix 权限演示：READ + WRITE + EXEC = 所有者的 rwx。Linux 将其存储为每个用户/组/其他 3 位 — 总共 9 位在一个整数中。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  bits.value |= (1 << 0); // READ
  message.value = t('READ (bit 0) set — like chmod\'s "r" flag', 'READ（位 0）已设置 — 类似 chmod 的 "r" 标志');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  bits.value |= (1 << 1); // WRITE
  message.value = t('WRITE (bit 1) set — like chmod\'s "w" flag', 'WRITE（位 1）已设置 — 类似 chmod 的 "w" 标志');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  bits.value |= (1 << 2); // EXEC
  message.value = t(
    'EXEC (bit 2) set — rwx = 0b00000111 = 7. That\'s why chmod 755 means owner=rwx, group=rx, other=rx. Three octal digits, nine bits.',
    'EXEC（位 2）已设置 — rwx = 0b00000111 = 7。这就是 chmod 755 意味着所有者=rwx，组=rx，其他=rx 的原因。三个八进制数字，九个位。'
  );
  presetRunning = false;
}

async function presetReactFlags() {
  if (presetRunning) return;
  clearTimers();
  presetRunning = true;
  bits.value = 0;
  message.value = t(
    'React Fiber flags: React stores work types as bitmask flags in ReactFiberFlags.js. Placement=2, Update=4, Deletion=8 — checked with (flags & Placement) !== 0.',
    'React Fiber 标志：React 在 ReactFiberFlags.js 中将工作类型存储为位掩码标志。Placement=2，Update=4，Deletion=8 — 通过 (flags & Placement) !== 0 检查。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  bits.value = 0b00000110; // Placement + Update
  message.value = t(
    'Placement | Update = 0b00000110 = 6. React checks if a fiber needs placement with: (flags & Placement) !== 0. Single CPU instruction!',
    'Placement | Update = 0b00000110 = 6。React 通过 (flags & Placement) !== 0 检查 fiber 是否需要放置。单条 CPU 指令！'
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  bits.value = 0b00001110; // + Deletion
  message.value = t(
    'Added Deletion flag: 0b00001110 = 14. Three operations encoded in one integer. Bitmasks let React batch-check multiple effects in constant time.',
    '添加 Deletion 标志：0b00001110 = 14。三个操作编码在一个整数中。位掩码让 React 在常数时间内批量检查多个效果。'
  );
  presetRunning = false;
}

async function presetMaskCheck() {
  if (presetRunning) return;
  clearTimers();
  presetRunning = true;
  bits.value = 0b10100101;
  message.value = t(
    'Checking if specific flags are set — the core operation. READ=1, EXEC=4, NET=32, IO=128. Testing with AND: (mask & flag) !== 0.',
    '检查特定标志是否设置 — 核心操作。READ=1，EXEC=4，NET=32，IO=128。使用 AND 测试：(mask & flag) !== 0。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  const hasRead = (bits.value & 1) !== 0;
  const hasWrite = (bits.value & 2) !== 0;
  message.value = t(
    `mask=0b${bits.value.toString(2).padStart(8, '0')}: READ=${hasRead}, WRITE=${hasWrite}. AND with a single bit extracts just that flag. This is how network firewalls check packet flags — TCP SYN/ACK/FIN are bitmask fields.`,
    `掩码=0b${bits.value.toString(2).padStart(8, '0')}：READ=${hasRead}，WRITE=${hasWrite}。与单个位进行 AND 只提取该标志。网络防火墙就是这样检查数据包标志的 — TCP SYN/ACK/FIN 是位掩码字段。`
  );
  presetRunning = false;
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
      <button class="viz-btn viz-btn--danger" @click="clearAllBits">{{ t('Clear All', '全部清除') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetUnixPerms">{{ t('Unix Perms', 'Unix 权限') }}</button>
      <button class="viz-btn" @click="presetReactFlags">{{ t('React Flags', 'React 标志') }}</button>
      <button class="viz-btn" @click="presetMaskCheck">{{ t('Mask Check', '掩码检查') }}</button>
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
