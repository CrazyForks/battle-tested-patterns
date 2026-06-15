<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeTimeout, safeInterval, clearAll, speed, delay, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const TOTAL_UNITS = 20;
const CHUNK_SIZE = 4;
const TICK_MS = 150;

const cooperative = ref(false);
const running = ref(false);
const progress = ref(0);
const blocked = ref(false);
const yieldGap = ref(false);
const ballY = ref(0);
const ballDir = ref(1);
const ballAnimating = ref(true);
const timeline = ref<Array<{ type: 'work' | 'yield' | 'idle'; chunk: number }>>([]);
const message = ref(
  t(
    'Toggle mode and click "Start Long Task" — or pick a scenario to compare blocking vs cooperative',
    '切换模式并点击"启动长任务" — 或选择场景对比阻塞与协作调度',
  ),
);
let presetRunning = false;

interface CsSnapshot {
  cooperative: boolean;
  progress: number;
  timeline: Array<{ type: string; chunk: number }>;
}

const vizHistory = useVizHistory<CsSnapshot>(
  { cooperative: false, progress: 0, timeline: [] },
  {
    getMessage: () => message.value,
    onRestore(snapshot, msg) {
      presetRunning = false;
      clearAll();
      cooperative.value = snapshot.cooperative;
      progress.value = snapshot.progress;
      timeline.value = snapshot.timeline as Array<{
        type: 'work' | 'yield' | 'idle';
        chunk: number;
      }>;
      running.value = false;
      blocked.value = false;
      yieldGap.value = false;
      if (msg !== undefined) message.value = msg;
    },
  },
);

function startBallAnimation() {
  safeInterval(() => {
    if (!ballAnimating.value) return;
    ballY.value += ballDir.value * 3;
    if (ballY.value >= 40) {
      ballY.value = 40;
      ballDir.value = -1;
    }
    if (ballY.value <= 0) {
      ballY.value = 0;
      ballDir.value = 1;
    }
  }, 30);
}

startBallAnimation();

function startTask() {
  if (running.value) return;
  running.value = true;
  progress.value = 0;
  timeline.value = [];
  blocked.value = false;
  yieldGap.value = false;

  if (cooperative.value) {
    runCooperative(0);
  } else {
    runBlocking();
  }
}

function runBlocking() {
  blocked.value = true;
  ballAnimating.value = false;
  message.value = t(
    'BLOCKING: Main thread is frozen! UI cannot update (ball stops). This is what happens with long synchronous loops in JavaScript.',
    '阻塞中：主线程被冻结！UI 无法更新（球停止）。这就是 JavaScript 中长同步循环会发生的情况。',
  );
  log(message.value, 'error');

  let done = 0;
  function tick() {
    if (done >= TOTAL_UNITS) {
      blocked.value = false;
      ballAnimating.value = true;
      running.value = false;
      message.value = t(
        `Done! All ${TOTAL_UNITS} units processed in one blocking run. UI was frozen the entire time — a 200ms task would cause visible jank in a 60fps app.`,
        `完成！所有 ${TOTAL_UNITS} 个单元在一次阻塞运行中处理完毕。UI 全程冻结 — 200ms 的任务会在 60fps 应用中造成明显卡顿。`,
      );
      log(message.value, 'warning');
      vizHistory.commit(
        { cooperative: cooperative.value, progress: progress.value, timeline: timeline.value },
        'blocking done',
      );
      return;
    }
    done++;
    progress.value = done;
    timeline.value = [...timeline.value, { type: 'work', chunk: 0 }];
    safeTimeout(tick, TICK_MS);
  }
  tick();
}

function runCooperative(startUnit: number) {
  const chunkNum = Math.floor(startUnit / CHUNK_SIZE);
  blocked.value = false;
  ballAnimating.value = true;
  yieldGap.value = false;

  let done = startUnit;
  const chunkEnd = Math.min(startUnit + CHUNK_SIZE, TOTAL_UNITS);

  message.value = t(
    `Chunk ${chunkNum + 1}: processing units ${startUnit + 1}-${chunkEnd}. The "yield" gap lets the browser paint, handle events, and run requestAnimationFrame.`,
    `分块 ${chunkNum + 1}：正在处理第 ${startUnit + 1}-${chunkEnd} 个单元。"让出"间隙让浏览器绘制、处理事件和运行 requestAnimationFrame。`,
  );
  log(message.value, 'info');

  function tick() {
    if (done >= chunkEnd) {
      if (done >= TOTAL_UNITS) {
        running.value = false;
        ballAnimating.value = true;
        message.value = t(
          `Done! ${TOTAL_UNITS} units in ${Math.ceil(TOTAL_UNITS / CHUNK_SIZE)} chunks. UI stayed responsive throughout! React's fiber scheduler uses this exact pattern — work in 5ms chunks, then yield to the browser.`,
          `完成！${TOTAL_UNITS} 个单元分 ${Math.ceil(TOTAL_UNITS / CHUNK_SIZE)} 块处理。UI 全程保持响应！React 的 fiber 调度器使用完全相同的模式 — 每次工作 5ms，然后让出给浏览器。`,
        );
        log(message.value, 'success');
        vizHistory.commit(
          { cooperative: cooperative.value, progress: progress.value, timeline: timeline.value },
          'cooperative done',
        );
        return;
      }
      yieldGap.value = true;
      ballAnimating.value = true;
      timeline.value = [...timeline.value, { type: 'yield', chunk: chunkNum }];
      message.value = t(
        "Yielding... UI can update (ball bounces). This is like React's shouldYield() — check if the browser needs the main thread back.",
        '让出中...UI 可以更新（球在跳动）。这类似 React 的 shouldYield() — 检查浏览器是否需要回收主线程。',
      );
      vizHistory.commit(
        { cooperative: cooperative.value, progress: progress.value, timeline: timeline.value },
        `yield chunk ${chunkNum + 1}`,
      );
      safeTimeout(() => {
        yieldGap.value = false;
        runCooperative(done);
      }, TICK_MS * 3);
      return;
    }
    done++;
    progress.value = done;
    timeline.value = [...timeline.value, { type: 'work', chunk: chunkNum }];
    safeTimeout(tick, TICK_MS);
  }
  tick();
}

function reset() {
  clearAll();
  running.value = false;
  progress.value = 0;
  blocked.value = false;
  yieldGap.value = false;
  ballAnimating.value = true;
  timeline.value = [];
  presetRunning = false;
  vizHistory.reset();
  message.value = t('Reset. Toggle mode and start again.', '已重置。切换模式并重新开始。');
  clearLog();
  startBallAnimation();
}

watch(cooperative, () => {
  if (!running.value) {
    message.value = cooperative.value
      ? t(
          'Cooperative mode: work split into chunks of 4, yielding between each. Used by React Fiber, scheduler.postTask(), and requestIdleCallback().',
          '协作模式：工作分为 4 个一组，每组间让出控制权。React Fiber、scheduler.postTask() 和 requestIdleCallback() 使用此模式。',
        )
      : t(
          'Blocking mode: all 20 units run without yielding. Simulates a long synchronous task on the main thread.',
          '阻塞模式：20 个单元不间断运行。模拟主线程上的长同步任务。',
        );
  }
});

async function presetSideBySide() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  clearLog();
  message.value = t(
    "First: blocking mode — watch the ball freeze. Then: cooperative mode — ball stays smooth. This is the core insight behind React's concurrent rendering.",
    '首先：阻塞模式 — 观察球冻结。然后：协作模式 — 球保持流畅。这是 React 并发渲染的核心洞察。',
  );
  log(message.value, 'highlight');
  await delay(1000);
  if (!presetRunning || isAborted()) return;
  cooperative.value = false;
  startTask();

  const waitForDone = () =>
    new Promise<void>((resolve) => {
      const check = () => {
        if (!running.value) {
          resolve();
          return;
        }
        safeTimeout(check, 100);
      };
      safeTimeout(check, 100);
    });
  await waitForDone();
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'Blocking done — UI was frozen. Now switching to cooperative mode...',
    '阻塞完成 — UI 已冻结。现在切换到协作模式...',
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  progress.value = 0;
  timeline.value = [];
  cooperative.value = true;
  startTask();
  presetRunning = false;
}

async function presetReactFiber() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  cooperative.value = true;
  clearLog();
  message.value = t(
    'React Fiber simulation: work is split into "units of work". After each chunk, React calls shouldYield() to check if the browser needs the thread. If yes, it pauses and resumes later.',
    'React Fiber 模拟：工作被分成"工作单元"。每块完成后，React 调用 shouldYield() 检查浏览器是否需要线程。如果是，暂停并稍后恢复。',
  );
  log(message.value, 'highlight');
  await delay(800);
  if (!presetRunning || isAborted()) return;
  startTask();
  presetRunning = false;
}

async function presetInputLatency() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  cooperative.value = false;
  clearLog();
  message.value = t(
    "Input latency demo: in blocking mode, user clicks and keystrokes are queued until the task finishes. Google's INP (Interaction to Next Paint) metric penalizes this — tasks > 50ms hurt your Core Web Vitals score.",
    '输入延迟演示：阻塞模式下，用户的点击和按键被排队直到任务完成。Google 的 INP（下次绘制的交互）指标会对此惩罚 — 超过 50ms 的任务会影响 Core Web Vitals 分数。',
  );
  log(message.value, 'highlight');
  await delay(800);
  if (!presetRunning || isAborted()) return;
  startTask();
  presetRunning = false;
}

const chunkColors = [
  'var(--viz-primary)',
  'var(--viz-success)',
  'var(--viz-warning)',
  '#8b5cf6',
  '#ec4899',
];
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">
      {{ t('Interactive Cooperative Scheduling', '交互式 Cooperative Scheduling') }}
    </div>

    <div class="cs-top-row">
      <!-- Mode toggle -->
      <div class="cs-toggle-wrap">
        <button
          class="cs-toggle"
          :class="{ 'cs-toggle--on': cooperative }"
          @click="cooperative = !cooperative"
          :disabled="running"
        >
          <span class="cs-toggle-knob"></span>
        </button>
        <span class="cs-toggle-label">{{
          cooperative ? t('Cooperative', '协作') : t('Blocking', '阻塞')
        }}</span>
      </div>

      <!-- Bouncing ball -->
      <div class="cs-ball-area">
        <div class="cs-ball-label">{{ t('UI Responsiveness', 'UI 响应性') }}</div>
        <div class="cs-ball-track">
          <div
            class="cs-ball"
            :class="{ 'cs-ball--frozen': blocked && !cooperative }"
            :style="{ transform: `translateY(${ballY}px)` }"
          ></div>
        </div>
        <div
          class="cs-ball-status"
          :class="blocked && !cooperative ? 'cs-ball-status--blocked' : 'cs-ball-status--ok'"
        >
          {{ blocked && !cooperative ? t('FROZEN', '冻结') : t('SMOOTH', '流畅') }}
        </div>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="cs-progress-section">
      <div class="cs-progress-header">
        <span class="cs-section-label">{{ t('Main Thread', '主线程') }}</span>
        <span class="cs-progress-count">{{ progress }} / {{ TOTAL_UNITS }}</span>
      </div>
      <div class="cs-progress-track">
        <div
          class="cs-progress-fill"
          :class="{
            'cs-progress-fill--blocked': blocked && !cooperative,
            'cs-progress-fill--cooperative': cooperative,
          }"
          :style="{ width: (progress / TOTAL_UNITS) * 100 + '%' }"
        ></div>
      </div>
    </div>

    <!-- Timeline visualization -->
    <div class="cs-timeline">
      <div class="cs-section-label">{{ t('Timeline', '时间线') }}</div>
      <div class="cs-timeline-bar">
        <div
          v-for="(entry, i) in timeline"
          :key="i"
          class="cs-timeline-unit"
          :class="{
            'cs-timeline-unit--work': entry.type === 'work',
            'cs-timeline-unit--yield': entry.type === 'yield',
          }"
          :style="
            entry.type === 'work'
              ? {
                  background: cooperative
                    ? chunkColors[entry.chunk % chunkColors.length]
                    : 'var(--viz-danger)',
                }
              : {}
          "
        >
          <span v-if="entry.type === 'yield'" class="cs-yield-label">UI</span>
        </div>
        <div v-if="timeline.length === 0" class="cs-timeline-empty">
          {{ t('waiting...', '等待中...') }}
        </div>
      </div>
      <div class="cs-timeline-legend">
        <span v-if="!cooperative" class="cs-legend-item">
          <span class="cs-legend-dot" style="background: var(--viz-danger)"></span>
          {{ t('Blocking work', '阻塞工作') }}
        </span>
        <template v-else>
          <span class="cs-legend-item">
            <span class="cs-legend-dot" style="background: var(--viz-primary)"></span>
            {{ t('Work chunk', '工作块') }}
          </span>
          <span class="cs-legend-item">
            <span class="cs-legend-dot cs-legend-dot--yield"></span>
            {{ t('Yield (UI runs)', '让出（UI 运行）') }}
          </span>
        </template>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="startTask" :disabled="running">
        {{ t('Start Long Task', '启动长任务') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetSideBySide">
        {{ t('Block → Coop', '阻塞 → 协作') }}
      </button>
      <button class="viz-btn" @click="presetReactFiber">
        {{ t('React Fiber', 'React Fiber') }}
      </button>
      <button class="viz-btn" @click="presetInputLatency">
        {{ t('Input Latency', '输入延迟') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.cs-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.cs-toggle-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cs-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  border: none;
  border-radius: var(--viz-radius);
  background: var(--viz-border);
  cursor: pointer;
  transition: background var(--viz-transition);
  padding: 0;
}

.cs-toggle--on {
  background: var(--viz-success);
}

.cs-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cs-toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--viz-transition);
}

.cs-toggle--on .cs-toggle-knob {
  transform: translateX(20px);
}

.cs-toggle-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--viz-text);
}

/* Bouncing ball */
.cs-ball-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.cs-ball-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
}

.cs-ball-track {
  width: 28px;
  height: 52px;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-lg);
  position: relative;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.cs-ball {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--viz-success);
  position: absolute;
  left: 50%;
  top: 0;
  margin-left: -6px;
  transition: background var(--viz-transition);
}

.cs-ball--frozen {
  background: var(--viz-danger);
}

.cs-ball-status {
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cs-ball-status--ok {
  color: var(--viz-success);
}

.cs-ball-status--blocked {
  color: var(--viz-danger);
}

/* Progress */
.cs-progress-section {
  margin-bottom: 0.75rem;
}

.cs-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.cs-section-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  letter-spacing: 0.03em;
}

.cs-progress-count {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.cs-progress-track {
  height: 12px;
  border-radius: var(--viz-radius-sm);
  background: var(--viz-cell-empty);
  overflow: hidden;
}

.cs-progress-fill {
  height: 100%;
  border-radius: var(--viz-radius-sm);
  transition: width var(--viz-transition);
  background: var(--viz-primary);
}

.cs-progress-fill--blocked {
  background: var(--viz-danger);
}

.cs-progress-fill--cooperative {
  background: var(--viz-success);
}

/* Timeline */
.cs-timeline {
  margin: 0.5rem 0;
}

.cs-timeline-bar {
  display: flex;
  gap: 1px;
  min-height: 28px;
  padding: 4px;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  overflow-x: auto;
  align-items: stretch;
  margin-top: 0.25rem;
}

.cs-timeline-unit {
  flex: 0 0 14px;
  min-height: 20px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: cs-unit-appear 0.15s ease;
}

.cs-timeline-unit--work {
  background: var(--viz-danger);
}

.cs-timeline-unit--yield {
  background: rgb(16 185 129 / 15%);
  border: 1px dashed var(--viz-success);
  flex: 0 0 28px;
}

.cs-yield-label {
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--viz-success);
}

.cs-timeline-empty {
  font-size: 0.75rem;
  color: var(--viz-muted);
  font-style: italic;
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
}

.cs-timeline-legend {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.375rem;
}

.cs-legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  color: var(--viz-muted);
}

.cs-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.cs-legend-dot--yield {
  background: rgb(16 185 129 / 15%);
  border: 1px dashed var(--viz-success);
}

@keyframes cs-unit-appear {
  from {
    opacity: 0;
    transform: scaleY(0.5);
  }

  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

@media (width <= 640px) {
  .cs-top-row {
    flex-direction: column;
    align-items: stretch;
  }

  .cs-ball-area {
    flex-direction: row;
    gap: 0.5rem;
  }

  .cs-ball-track {
    width: 52px;
    height: 28px;
  }

  .cs-ball {
    top: 50%;
    left: 0;
    margin-top: -6px;
    margin-left: 0;
  }

  .cs-timeline-unit {
    flex: 0 0 10px;
  }

  .cs-timeline-unit--yield {
    flex: 0 0 20px;
  }
}
</style>
