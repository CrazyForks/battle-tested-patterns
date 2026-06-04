<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

interface Task {
  label: string;
  type: 'sync' | 'macro' | 'micro';
  id: number;
}

let nextId = 0;

const callStack = ref<Task[]>([]);
const macroQueue = ref<Task[]>([]);
const microQueue = ref<Task[]>([]);
const log = ref<string[]>([]);
const message = ref(t(
  'Add tasks and step through the event loop — or pick a scenario to see key behaviors',
  '添加任务并逐步执行 Event Loop — 或选择场景查看关键行为'
));
const running = ref(false);
const currentPhase = ref<'idle' | 'stack' | 'micro' | 'macro'>('idle');

function addSync() {
  callStack.value.push({ label: `fn${nextId}()`, type: 'sync', id: nextId++ });
  message.value = t(
    'Synchronous function pushed to call stack. It will execute before any queued tasks.',
    '同步函数已压入调用栈。它将在任何排队任务之前执行。'
  );
}

function addMacro() {
  const labels = ['setTimeout cb', 'setInterval cb', 'I/O callback', 'click handler'];
  const label = labels[nextId % labels.length];
  macroQueue.value.push({ label, type: 'macro', id: nextId++ });
  message.value = t(
    `"${label}" queued as macrotask. Only one macrotask runs per event loop iteration.`,
    `"${label}" 作为宏任务入队。每次事件循环迭代只运行一个宏任务。`
  );
}

function addMicro() {
  const labels = ['Promise.then', 'queueMicrotask', 'MutationObserver', 'await resume'];
  const label = labels[nextId % labels.length];
  microQueue.value.push({ label, type: 'micro', id: nextId++ });
  message.value = t(
    `"${label}" queued as microtask. ALL microtasks drain before the next macrotask — this is the key rule.`,
    `"${label}" 作为微任务入队。所有微任务在下一个宏任务之前全部执行 — 这是核心规则。`
  );
}

function loadDemo() {
  reset();
  callStack.value.push({ label: 'main()', type: 'sync', id: nextId++ });
  macroQueue.value.push(
    { label: 'setTimeout cb', type: 'macro', id: nextId++ },
    { label: 'click handler', type: 'macro', id: nextId++ },
  );
  microQueue.value.push(
    { label: 'Promise.then', type: 'micro', id: nextId++ },
    { label: 'await resume', type: 'micro', id: nextId++ },
  );
  message.value = t(
    'Demo loaded — click Step to walk through. Watch: microtasks run BEFORE macrotasks.',
    '示例已加载 — 点击"单步"逐步执行。注意：微任务在宏任务之前运行。'
  );
}

async function loadPromiseChain() {
  reset();
  callStack.value.push({ label: 'main()', type: 'sync', id: nextId++ });
  macroQueue.value.push({ label: 'setTimeout(A, 0)', type: 'macro', id: nextId++ });
  microQueue.value.push(
    { label: 'Promise.then(B)', type: 'micro', id: nextId++ },
    { label: '.then(C)', type: 'micro', id: nextId++ },
    { label: '.then(D)', type: 'micro', id: nextId++ },
  );
  message.value = t(
    'Promise chain vs setTimeout(0): B→C→D run before A. Microtasks always drain first — even with setTimeout(fn, 0).',
    'Promise 链 vs setTimeout(0)：B→C→D 在 A 之前运行。微任务总是先排空 — 即使 setTimeout(fn, 0) 也不例外。'
  );
}

async function loadStarvation() {
  reset();
  callStack.value.push({ label: 'main()', type: 'sync', id: nextId++ });
  macroQueue.value.push({ label: 'UI repaint', type: 'macro', id: nextId++ });
  microQueue.value.push(
    { label: 'micro 1', type: 'micro', id: nextId++ },
    { label: 'micro 2', type: 'micro', id: nextId++ },
    { label: 'micro 3', type: 'micro', id: nextId++ },
    { label: 'micro 4', type: 'micro', id: nextId++ },
    { label: 'micro 5', type: 'micro', id: nextId++ },
  );
  message.value = t(
    'Microtask starvation: 5 microtasks block the "UI repaint" macrotask. In real apps, recursive microtasks can freeze the UI.',
    '微任务饥饿：5 个微任务阻塞了"UI repaint"宏任务。在实际应用中，递归微任务可能冻结 UI。'
  );
}

async function step() {
  if (running.value) return;
  running.value = true;

  if (callStack.value.length > 0) {
    currentPhase.value = 'stack';
    const task = callStack.value.pop()!;
    log.value.push(`▶ ${task.label}`);
    message.value = t(
      `Executing "${task.label}" — synchronous code always runs to completion before checking queues.`,
      `正在执行 "${task.label}" — 同步代码总是运行完毕后才检查队列。`
    );
    await delay(400);
    if (isAborted()) return;
    running.value = false;
    if (callStack.value.length === 0 && microQueue.value.length === 0 && macroQueue.value.length === 0) {
      currentPhase.value = 'idle';
    }
    return;
  }

  if (microQueue.value.length > 0) {
    currentPhase.value = 'micro';
    const microCount = microQueue.value.length;
    while (microQueue.value.length > 0) {
      const task = microQueue.value.shift()!;
      callStack.value.push(task);
      message.value = t(
        `Draining microtask "${task.label}" → stack. ALL ${microCount} microtasks run before next macrotask.`,
        `排空微任务 "${task.label}" → 栈。全部 ${microCount} 个微任务在下一个宏任务前运行。`
      );
      await delay(300);
      if (isAborted()) return;
      callStack.value.pop();
      log.value.push(`▶ ${task.label}`);
      await delay(200);
      if (isAborted()) return;
    }
    running.value = false;
    if (macroQueue.value.length === 0) currentPhase.value = 'idle';
    return;
  }

  if (macroQueue.value.length > 0) {
    currentPhase.value = 'macro';
    const task = macroQueue.value.shift()!;
    callStack.value.push(task);
    message.value = t(
      `Macrotask "${task.label}" → stack. Only ONE macrotask per iteration — then check microtasks again.`,
      `宏任务 "${task.label}" → 栈。每次迭代只处理一个宏任务 — 然后再检查微任务。`
    );
    await delay(300);
    if (isAborted()) return;
    callStack.value.pop();
    log.value.push(`▶ ${task.label}`);
    await delay(200);
    if (isAborted()) return;
    running.value = false;
    currentPhase.value = 'idle';
    return;
  }

  message.value = t(
    'All queues empty — event loop is idle. In Node.js/browsers, it polls for new I/O events here.',
    '所有队列为空 — 事件循环空闲。在 Node.js/浏览器中，它在此轮询新的 I/O 事件。'
  );
  currentPhase.value = 'idle';
  running.value = false;
}

async function runAll() {
  if (running.value) return;
  while (callStack.value.length > 0 || microQueue.value.length > 0 || macroQueue.value.length > 0) {
    await step();
    if (isAborted()) return;
    await delay(100);
    if (isAborted()) return;
  }
}

function reset() {
  clearAll();
  callStack.value = [];
  macroQueue.value = [];
  microQueue.value = [];
  log.value = [];
  currentPhase.value = 'idle';
  running.value = false;
  message.value = t('Event loop reset.', 'Event Loop 已重置。');
  nextId = 0;
}

const phaseLabel = computed(() => {
  switch (currentPhase.value) {
    case 'stack': return t('EXECUTING STACK', '执行调用栈');
    case 'micro': return t('DRAINING MICROTASKS', '清空微任务');
    case 'macro': return t('PROCESSING MACROTASK', '处理宏任务');
    default: return t('IDLE', '空闲');
  }
});

const phaseColor = computed(() => {
  switch (currentPhase.value) {
    case 'stack': return 'var(--viz-primary)';
    case 'micro': return 'var(--viz-success)';
    case 'macro': return 'var(--viz-warning)';
    default: return 'var(--viz-muted)';
  }
});
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Event Loop', '交互式 Event Loop') }}</div>

    <div class="el-phase" :style="{ borderColor: phaseColor }">
      <span class="el-phase-dot" :style="{ background: phaseColor }"></span>
      {{ phaseLabel }}
    </div>

    <div class="el-columns">
      <div class="el-column">
        <div class="el-col-header">{{ t('Call Stack', '调用栈') }}</div>
        <div class="el-stack">
          <div v-if="callStack.length === 0" class="el-empty">{{ t('empty', '空') }}</div>
          <div
            v-for="task in [...callStack].reverse()"
            :key="task.id"
            class="el-item el-item--sync"
          >{{ task.label }}</div>
        </div>
      </div>

      <div class="el-column">
        <div class="el-col-header">{{ t('Microtask Queue', '微任务队列') }}</div>
        <div class="el-queue">
          <div v-if="microQueue.length === 0" class="el-empty">{{ t('empty', '空') }}</div>
          <div
            v-for="task in microQueue"
            :key="task.id"
            class="el-item el-item--micro"
          >{{ task.label }}</div>
        </div>
      </div>

      <div class="el-column">
        <div class="el-col-header">{{ t('Macrotask Queue', '宏任务队列') }}</div>
        <div class="el-queue">
          <div v-if="macroQueue.length === 0" class="el-empty">{{ t('empty', '空') }}</div>
          <div
            v-for="task in macroQueue"
            :key="task.id"
            class="el-item el-item--macro"
          >{{ task.label }}</div>
        </div>
      </div>
    </div>

    <div v-if="log.length > 0" class="el-log">
      <span class="viz-label">{{ t('Log:', '日志:') }}&nbsp;</span>
      <span v-for="(entry, i) in log.slice(-8)" :key="i" class="el-log-entry">{{ entry }}</span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn" @click="addSync">{{ t('+ Sync', '+ 同步') }}</button>
      <button class="viz-btn" @click="addMacro">{{ t('+ Macro', '+ 宏任务') }}</button>
      <button class="viz-btn" @click="addMicro">{{ t('+ Micro', '+ 微任务') }}</button>
      <button class="viz-btn viz-btn--primary" @click="step" :disabled="running">{{ t('Step', '单步') }}</button>
      <button class="viz-btn" @click="runAll" :disabled="running">{{ t('Run All', '全部执行') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="loadDemo">{{ t('Basic Demo', '基础演示') }}</button>
      <button class="viz-btn" @click="loadPromiseChain">{{ t('Promise vs setTimeout', 'Promise vs setTimeout') }}</button>
      <button class="viz-btn" @click="loadStarvation">{{ t('Microtask Starvation', '微任务饥饿') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.el-phase {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.35rem 0.75rem;
  border: 2px solid var(--viz-muted);
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  letter-spacing: 0.05em;
  color: var(--viz-text);
  margin-bottom: 1rem;
  transition: border-color 0.3s;
}

.el-phase-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background 0.3s;
}

.el-columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .el-columns {
    grid-template-columns: 1fr;
  }
}

.el-column {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.el-col-header {
  padding: 0.4rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--viz-muted);
  background: var(--viz-bg);
  border-bottom: 1px solid var(--viz-border);
}

.el-stack, .el-queue {
  min-height: 80px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.el-empty {
  color: var(--viz-muted);
  font-size: 0.75rem;
  font-style: italic;
  padding: 0.5rem;
  text-align: center;
}

.el-item {
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: #fff;
  animation: viz-slide-in 0.2s ease;
}

.el-item--sync { background: var(--viz-primary); }
.el-item--micro { background: var(--viz-success); }
.el-item--macro { background: var(--viz-warning); }

.el-log {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 0.5rem 0;
}

.el-log-entry {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  background: var(--viz-bg);
  color: var(--viz-text);
  border: 1px solid var(--viz-border);
}
</style>
