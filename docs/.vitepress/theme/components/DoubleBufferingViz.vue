<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, safeInterval, safeTimeout, clearAll, speed, isAborted } = useVizTimers();

const COLS = 4;
const ROWS = 3;
const CELL_COUNT = COLS * ROWS;

const PALETTE = [
  'var(--viz-primary)',
  'var(--viz-success)',
  'var(--viz-warning)',
  'var(--viz-danger)',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

type BufferData = (string | null)[];

function emptyBuffer(): BufferData {
  return Array(CELL_COUNT).fill(null);
}

function generateFrame(frame: number): BufferData {
  const buf: BufferData = Array(CELL_COUNT).fill(null);
  const pattern = frame % 5;

  if (pattern === 0) {
    for (let i = 0; i < Math.min(ROWS, COLS); i++) {
      buf[i * COLS + i] = PALETTE[frame % PALETTE.length];
    }
  } else if (pattern === 1) {
    for (let c = 0; c < COLS; c++) {
      buf[c] = PALETTE[(frame + 1) % PALETTE.length];
      buf[(ROWS - 1) * COLS + c] = PALETTE[(frame + 2) % PALETTE.length];
    }
  } else if (pattern === 2) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) {
          buf[r * COLS + c] = PALETTE[(frame + r) % PALETTE.length];
        }
      }
    }
  } else if (pattern === 3) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          buf[r * COLS + c] = PALETTE[(frame + c) % PALETTE.length];
        }
      }
    }
  } else {
    const col = frame % COLS;
    for (let r = 0; r < ROWS; r++) {
      buf[r * COLS + col] = PALETTE[(frame + r) % PALETTE.length];
    }
  }

  return buf;
}

const frontBuffer = ref<BufferData>(emptyBuffer());
const backBuffer = ref<BufferData>(emptyBuffer());
const frameCount = ref(0);
const nextFrame = ref(1);
const swapping = ref(false);
const autoMode = ref(false);
const message = ref(t(
  'Draw a frame in the back buffer, then swap to display — or pick a scenario below',
  '在后端缓冲区绘制帧，然后交换以显示 — 或选择下方场景'
));
let presetRunning = false;

function drawFrame() {
  const frame = nextFrame.value++;
  backBuffer.value = generateFrame(frame);
  frameCount.value++;
  message.value = t(
    `Frame #${frameCount.value} drawn in back buffer — invisible to the user. The front buffer keeps displaying the previous frame with zero tearing.`,
    `帧 #${frameCount.value} 已绘制到后端缓冲区 — 用户不可见。前端缓冲区继续显示上一帧，零撕裂。`
  );
}

function swapBuffers() {
  if (swapping.value) return;
  swapping.value = true;

  safeTimeout(() => {
    const temp = frontBuffer.value;
    frontBuffer.value = backBuffer.value;
    backBuffer.value = temp;
    swapping.value = false;
    message.value = t(
      `Buffers swapped — O(1) pointer swap, not a copy. This is why OpenGL uses glSwapBuffers() and React swaps fiber trees.`,
      `缓冲区已交换 — O(1) 指针交换，非复制。这就是 OpenGL 使用 glSwapBuffers() 和 React 交换 fiber 树的原因。`
    );
  }, 300);
}

function toggleAuto() {
  autoMode.value = !autoMode.value;
  if (autoMode.value) {
    message.value = t(
      'Auto mode: continuous draw + swap loop. This is what a GPU does at 60 FPS — draw to back, swap to front, repeat.',
      '自动模式：连续绘制 + 交换循环。这就是 GPU 以 60 FPS 运行的方式 — 绘制到后端，交换到前端，循环。'
    );
    safeInterval(() => {
      drawFrame();
      safeTimeout(() => swapBuffers(), 200);
    }, 500);
  } else {
    clearAll();
    message.value = t('Auto mode stopped', '自动模式已停止');
  }
}

function reset() {
  clearAll();
  autoMode.value = false;
  frontBuffer.value = emptyBuffer();
  backBuffer.value = emptyBuffer();
  frameCount.value = 0;
  nextFrame.value = 1;
  swapping.value = false;
  presetRunning = false;
  message.value = t('Reset! Draw a frame to start.', '已重置！绘制帧以开始。');
}

async function presetTearDemo() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Without double buffering, drawing directly to the display causes "tearing" — the user sees a half-drawn frame. Watch the back buffer fill first...',
    '没有双缓冲时，直接绘制到显示器会导致"撕裂" — 用户看到半绘制的帧。观察后端缓冲区先被填充...'
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  drawFrame();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Frame drawn in back buffer — user sees nothing yet. Now swapping atomically...',
    '帧已绘制到后端缓冲区 — 用户什么都看不到。现在原子交换...'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  swapBuffers();
  await delay(600);
  if (!presetRunning || isAborted()) return;
  drawFrame();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  swapBuffers();
  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Two frames rendered with zero tearing. The key: users never see incomplete state. React\'s concurrent mode uses the same principle — render to a hidden tree, then commit.',
    '两帧渲染，零撕裂。关键：用户永远不会看到不完整状态。React 的并发模式使用相同原理 — 渲染到隐藏树，然后提交。'
  );
  presetRunning = false;
}

async function presetHighFPS() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Simulating 5 rapid frames — each drawn then swapped. In real GPUs, VSYNC synchronizes the swap with the monitor\'s refresh rate to prevent tearing.',
    '模拟 5 个快速帧 — 每帧绘制后交换。在真实 GPU 中，VSYNC 将交换与显示器刷新率同步以防止撕裂。'
  );
  await delay(800);
  for (let i = 0; i < 5; i++) {
    if (!presetRunning || isAborted()) return;
    drawFrame();
    await delay(400);
    if (!presetRunning || isAborted()) return;
    swapBuffers();
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    `5 frames rendered at ${frameCount.value} total. Triple buffering adds a third buffer to reduce latency — used by modern game engines like Unreal.`,
    `5 帧渲染完成，共 ${frameCount.value} 帧。三重缓冲添加第三个缓冲区以减少延迟 — 现代游戏引擎如 Unreal 使用此技术。`
  );
  presetRunning = false;
}

async function presetReactCommit() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'React\'s commit phase is double buffering: the "work-in-progress" fiber tree (back buffer) is built off-screen, then swapped with the "current" tree (front buffer) in one synchronous step.',
    'React 的提交阶段就是双缓冲："工作中"的 fiber 树（后端缓冲区）在屏幕外构建，然后在一个同步步骤中与"当前"树（前端缓冲区）交换。'
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  drawFrame();
  message.value = t(
    'Step 1: React builds the new fiber tree (back buffer). User sees the old UI.',
    '步骤 1：React 构建新的 fiber 树（后端缓冲区）。用户看到旧 UI。'
  );
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  swapBuffers();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Step 2: commitRoot() swaps current ↔ workInProgress — the DOM updates atomically. No intermediate states visible. This is React\'s "double buffering of fiber trees".',
    '步骤 2：commitRoot() 交换 current ↔ workInProgress — DOM 原子更新。没有中间状态可见。这就是 React 的"fiber 树双缓冲"。'
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Double Buffering', '交互式 Double Buffering') }}</div>

    <div class="db-layout" :class="{ 'db-swapping': swapping }">
      <!-- Front Buffer -->
      <div class="db-buffer">
        <div class="db-buffer-label">
          <span class="db-dot db-dot--front"></span>
          {{ t('Front Buffer (Display)', '前端缓冲区（显示）') }}
        </div>
        <div class="db-grid">
          <div
            v-for="(color, i) in frontBuffer"
            :key="'f-' + i"
            class="db-cell"
            :class="{ 'db-cell--filled': color }"
            :style="color ? { backgroundColor: color } : {}"
          />
        </div>
        <div class="db-badge db-badge--active">{{ t('VISIBLE', '可见') }}</div>
      </div>

      <!-- Swap Arrow -->
      <div class="db-swap-arrow" :class="{ 'db-swap-arrow--animating': swapping }">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <path
            d="M8 18h24l-8-8"
            fill="none"
            stroke="var(--viz-primary)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M40 30H16l8 8"
            fill="none"
            stroke="var(--viz-success)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <!-- Back Buffer -->
      <div class="db-buffer">
        <div class="db-buffer-label">
          <span class="db-dot db-dot--back"></span>
          {{ t('Back Buffer (Drawing)', '后端缓冲区（绘制）') }}
        </div>
        <div class="db-grid">
          <div
            v-for="(color, i) in backBuffer"
            :key="'b-' + i"
            class="db-cell"
            :class="{ 'db-cell--filled': color }"
            :style="color ? { backgroundColor: color } : {}"
          />
        </div>
        <div class="db-badge db-badge--drawing">{{ t('DRAWING', '绘制中') }}</div>
      </div>
    </div>

    <div class="db-frame-counter">
      {{ t('Frame:', '帧：') }} <span class="db-frame-number">{{ frameCount }}</span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn" :disabled="autoMode" @click="drawFrame">{{ t('Draw Frame', '绘制帧') }}</button>
      <button class="viz-btn viz-btn--primary" :disabled="autoMode || swapping" @click="swapBuffers">{{ t('Swap', '交换') }}</button>
      <button
        class="viz-btn"
        :class="{ 'db-btn--auto-active': autoMode }"
        @click="toggleAuto"
      >
        {{ autoMode ? t('Stop Auto', '停止自动') : t('Auto', '自动') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetTearDemo">{{ t('Zero Tearing', '零撕裂') }}</button>
      <button class="viz-btn" @click="presetHighFPS">{{ t('High FPS', '高帧率') }}</button>
      <button class="viz-btn" @click="presetReactCommit">{{ t('React Commit', 'React 提交') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.db-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  transition: opacity 0.3s ease;
}

.db-buffer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px solid var(--viz-border);
  border-radius: var(--viz-radius);
  background: var(--vp-c-bg);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  position: relative;
}

.db-swapping .db-buffer {
  animation: db-buffer-flash 0.3s ease;
}

.db-buffer-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--viz-text);
  white-space: nowrap;
}

.db-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.db-dot--front {
  background: var(--viz-success);
}

.db-dot--back {
  background: var(--viz-warning);
}

.db-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}

.db-cell {
  width: 36px;
  height: 28px;
  border-radius: 4px;
  background: var(--viz-cell-empty);
  transition: background-color 0.25s ease, transform 0.2s ease;
}

.db-cell--filled {
  animation: db-cell-appear 0.3s ease;
}

.db-badge {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.db-badge--active {
  background: var(--viz-success);
  color: #fff;
}

.db-badge--drawing {
  background: var(--viz-warning);
  color: #fff;
}

.db-swap-arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.2s ease, transform 0.3s ease;
}

.db-swap-arrow--animating {
  opacity: 1;
  animation: db-arrow-pulse 0.3s ease;
}

.db-frame-counter {
  text-align: center;
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
}

.db-frame-number {
  font-weight: 700;
  color: var(--viz-primary);
  font-size: 1rem;
}

.db-btn--auto-active {
  background: var(--viz-success);
  border-color: var(--viz-success);
  color: #fff;
}

.db-btn--auto-active:hover {
  opacity: 0.9;
  color: #fff;
}

@keyframes db-cell-appear {
  0% { transform: scale(0.7); opacity: 0.4; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes db-buffer-flash {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3); }
}

@keyframes db-arrow-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@media (max-width: 640px) {
  .db-layout {
    flex-direction: column;
  }

  .db-swap-arrow {
    transform: rotate(90deg);
  }

  .db-swap-arrow--animating {
    animation: db-arrow-pulse-mobile 0.3s ease;
  }

  .db-cell {
    width: 32px;
    height: 24px;
  }
}

@keyframes db-arrow-pulse-mobile {
  0%, 100% { transform: rotate(90deg) scale(1); }
  50% { transform: rotate(90deg) scale(1.2); }
}
</style>
