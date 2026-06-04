<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

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
const message = ref(t('Add tasks and step through the event loop', '添加任务并逐步执行 Event Loop'));
const running = ref(false);
const currentPhase = ref<'idle' | 'stack' | 'micro' | 'macro'>('idle');

function addSync() {
  callStack.value.push({ label: `fn${nextId}()`, type: 'sync', id: nextId++ });
  message.value = t('Synchronous function pushed to call stack', '同步函数已压入调用栈');
}

function addMacro() {
  const labels = ['setTimeout cb', 'setInterval cb', 'I/O callback', 'click handler'];
  const label = labels[nextId % labels.length];
  macroQueue.value.push({ label, type: 'macro', id: nextId++ });
  message.value = t(`"${label}" added to macrotask queue`, `"${label}" 已添加到宏任务队列`);
}

function addMicro() {
  const labels = ['Promise.then', 'queueMicrotask', 'MutationObserver', 'await resume'];
  const label = labels[nextId % labels.length];
  microQueue.value.push({ label, type: 'micro', id: nextId++ });
  message.value = t(`"${label}" added to microtask queue`, `"${label}" 已添加到微任务队列`);
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
  message.value = t('Demo loaded — click Step to walk through execution', '示例已加载 - 点击"单步"逐步执行');
}

let aborted = false;
onUnmounted(() => { aborted = true; });

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function step() {
  if (running.value) return;
  running.value = true;

  // 1. Execute call stack (synchronous)
  if (callStack.value.length > 0) {
    currentPhase.value = 'stack';
    const task = callStack.value.pop()!;
    log.value.push(`▶ ${task.label}`);
    message.value = t(`Executing "${task.label}" from call stack`, `正在执行调用栈中的 "${task.label}"`);
    await delay(400);
    if (aborted) return;
    running.value = false;
    if (callStack.value.length === 0 && microQueue.value.length === 0 && macroQueue.value.length === 0) {
      currentPhase.value = 'idle';
    }
    return;
  }

  // 2. Drain microtask queue
  if (microQueue.value.length > 0) {
    currentPhase.value = 'micro';
    while (microQueue.value.length > 0) {
      const task = microQueue.value.shift()!;
      callStack.value.push(task);
      message.value = t(`Microtask "${task.label}" → call stack`, `微任务 "${task.label}" → 调用栈`);
      await delay(300);
      if (aborted) return;
      callStack.value.pop();
      log.value.push(`▶ ${task.label}`);
      message.value = t(`Executed "${task.label}"`, `已执行 "${task.label}"`);
      await delay(200);
      if (aborted) return;
    }
    running.value = false;
    if (macroQueue.value.length === 0) currentPhase.value = 'idle';
    return;
  }

  // 3. Take ONE macrotask
  if (macroQueue.value.length > 0) {
    currentPhase.value = 'macro';
    const task = macroQueue.value.shift()!;
    callStack.value.push(task);
    message.value = t(`Macrotask "${task.label}" → call stack`, `宏任务 "${task.label}" → 调用栈`);
    await delay(300);
    if (aborted) return;
    callStack.value.pop();
    log.value.push(`▶ ${task.label}`);
    message.value = t(`Executed "${task.label}" — check microtasks next`, `已执行 "${task.label}" - 接下来检查微任务`);
    await delay(200);
    if (aborted) return;
    running.value = false;
    currentPhase.value = 'idle';
    return;
  }

  message.value = t('All queues empty — event loop is idle', '所有队列为空 - Event Loop 空闲');
  currentPhase.value = 'idle';
  running.value = false;
}

async function runAll() {
  if (running.value) return;
  while (callStack.value.length > 0 || microQueue.value.length > 0 || macroQueue.value.length > 0) {
    await step();
    if (aborted) return;
    await delay(100);
    if (aborted) return;
  }
}

function reset() {
  callStack.value = [];
  macroQueue.value = [];
  microQueue.value = [];
  log.value = [];
  currentPhase.value = 'idle';
  running.value = false;
  message.value = t('Event loop reset', 'Event Loop 已重置');
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
      <!-- Call Stack -->
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

      <!-- Microtask Queue -->
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

      <!-- Macrotask Queue -->
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

    <!-- Execution Log -->
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
      <button class="viz-btn" @click="loadDemo">{{ t('Demo', '示例') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
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
  animation: el-slide-in 0.2s ease;
}

.el-item--sync {
  background: var(--viz-primary);
}

.el-item--micro {
  background: var(--viz-success);
}

.el-item--macro {
  background: var(--viz-warning);
}

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

@keyframes el-slide-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
