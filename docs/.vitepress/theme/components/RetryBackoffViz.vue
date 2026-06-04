<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

interface Attempt {
  number: number;
  delay: number;
  jitter: number;
  totalDelay: number;
  result: 'pending' | 'waiting' | 'success' | 'fail';
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

const failureRate = ref(70);
const running = ref(false);
const attempts = ref<Attempt[]>([]);
const message = ref(t(
  'Configure failure rate and click "Send Request" — or pick a scenario below',
  '配置失败率并点击"发送请求" — 或选择下方场景'
));
const finalOutcome = ref<'idle' | 'success' | 'exhausted'>('idle');
let presetRunning = false;

const maxPossibleDelay = computed(() => {
  let total = 0;
  for (let i = 0; i < MAX_RETRIES; i++) {
    total += BASE_DELAY * Math.pow(2, i);
  }
  return total;
});

function addJitter(baseDelay: number): { jitter: number; total: number } {
  const maxJitter = baseDelay * 0.3;
  const jitter = Math.round((Math.random() * 2 - 1) * maxJitter);
  return { jitter, total: Math.max(50, baseDelay + jitter) };
}

function simulateCall(): boolean {
  return Math.random() * 100 >= failureRate.value;
}

async function startRequest() {
  if (running.value) return;

  running.value = true;
  attempts.value = [];
  finalOutcome.value = 'idle';
  message.value = t(
    'Sending initial request... First attempt has zero delay — only retries back off.',
    '正在发送初始请求... 首次尝试零延迟 — 仅重试时退避。'
  );

  for (let i = 0; i < MAX_RETRIES; i++) {
    const attemptDelay = i === 0 ? 0 : BASE_DELAY * Math.pow(2, i - 1);
    const { jitter, total: totalDelay } = i === 0
      ? { jitter: 0, total: 0 }
      : addJitter(attemptDelay);

    const attempt: Attempt = {
      number: i + 1,
      delay: attemptDelay,
      jitter,
      totalDelay,
      result: i === 0 ? 'pending' : 'waiting',
    };
    attempts.value.push(attempt);

    if (i > 0) {
      message.value = t(
        `Waiting ${totalDelay}ms before attempt #${i + 1} (base ${attemptDelay}ms × 2^${i - 1} + ${jitter >= 0 ? '+' : ''}${jitter}ms jitter). Exponential backoff prevents thundering herd.`,
        `等待 ${totalDelay}ms 后进行第 ${i + 1} 次尝试（基础 ${attemptDelay}ms × 2^${i - 1} + ${jitter >= 0 ? '+' : ''}${jitter}ms 抖动）。指数退避防止惊群效应。`
      );
      const scaledDelay = Math.min(totalDelay / 2, 1500);
      await delay(scaledDelay);
      if (!running.value || isAborted()) return;
    }

    attempts.value[i].result = 'pending';
    message.value = t(`Attempt #${i + 1} — sending request...`, `第 ${i + 1} 次尝试 — 正在发送请求...`);
    await delay(300);
    if (!running.value || isAborted()) return;

    const success = simulateCall();

    if (success) {
      attempts.value[i].result = 'success';
      finalOutcome.value = 'success';
      message.value = t(
        `Success on attempt #${i + 1}!${i > 0 ? ` Recovered after ${i} ${i === 1 ? 'retry' : 'retries'}. AWS SDKs and gRPC use this exact backoff strategy.` : ' First try succeeded — no backoff needed.'}`,
        `第 ${i + 1} 次尝试成功！${i > 0 ? `经过 ${i} 次重试后恢复。AWS SDK 和 gRPC 使用完全相同的退避策略。` : '首次尝试即成功 — 无需退避。'}`
      );
      running.value = false;
      return;
    }

    attempts.value[i].result = 'fail';
    if (i === MAX_RETRIES - 1) {
      finalOutcome.value = 'exhausted';
      message.value = t(
        `All ${MAX_RETRIES} attempts failed — circuit breaker should open now. Total backoff time: ${timelineTotalMs.value}ms. Without a cap, exponential growth becomes dangerous.`,
        `全部 ${MAX_RETRIES} 次尝试均失败 — 断路器应该开启。总退避时间：${timelineTotalMs.value}ms。没有上限时，指数增长会变得危险。`
      );
    }
  }

  running.value = false;
}

function reset() {
  clearAll();
  running.value = false;
  attempts.value = [];
  finalOutcome.value = 'idle';
  presetRunning = false;
  message.value = t(
    'Configure failure rate and click "Send Request" — or pick a scenario below',
    '配置失败率并点击"发送请求" — 或选择下方场景'
  );
}

const timelineTotalMs = computed(() => {
  if (attempts.value.length === 0) return 0;
  let sum = 0;
  for (const a of attempts.value) {
    sum += a.totalDelay;
  }
  return sum;
});

function barWidth(attempt: Attempt): string {
  if (attempt.totalDelay === 0 || maxPossibleDelay.value === 0) return '2%';
  const pct = (attempt.totalDelay / maxPossibleDelay.value) * 100;
  return `${Math.max(2, Math.min(pct, 100))}%`;
}

function barColor(result: Attempt['result']): string {
  switch (result) {
    case 'success': return 'var(--viz-success)';
    case 'fail': return 'var(--viz-danger)';
    case 'waiting': return 'var(--viz-warning)';
    case 'pending': return 'var(--viz-primary)';
  }
}

function resultLabel(result: Attempt['result']): string {
  switch (result) {
    case 'success': return t('OK', '成功');
    case 'fail': return t('FAIL', '失败');
    case 'waiting': return t('WAIT', '等待');
    case 'pending': return '...';
  }
}

const statusBorderColor = computed(() => {
  switch (finalOutcome.value) {
    case 'success': return 'var(--viz-success)';
    case 'exhausted': return 'var(--viz-danger)';
    default: return running.value ? 'var(--viz-warning)' : 'var(--viz-border)';
  }
});

async function presetGuaranteedFail() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  failureRate.value = 100;
  await delay(300);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    '100% failure rate — all 5 attempts will fail. Watch the exponential delay growth: 1s → 2s → 4s → 8s. This is why you need a max backoff cap.',
    '100% 失败率 — 全部 5 次尝试都会失败。观察指数延迟增长：1s → 2s → 4s → 8s。这就是为什么你需要最大退避上限。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  await startRequest();
  presetRunning = false;
}

async function presetFlaky() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  failureRate.value = 50;
  await delay(300);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    '50% failure rate — simulates a flaky network. Jitter randomizes retry timing so clients don\'t retry in sync — preventing the "thundering herd" that crashed early AWS services.',
    '50% 失败率 — 模拟不稳定网络。抖动随机化重试时间，使客户端不会同步重试 — 防止早期 AWS 服务遭遇的"惊群效应"崩溃。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  await startRequest();
  presetRunning = false;
}

async function presetNoBackoff() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  failureRate.value = 70;
  await delay(300);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Watch the delay bars grow exponentially: each retry waits 2x longer. Without this, a failing server receives retry storms at full rate — making recovery impossible.',
    '观察延迟条指数增长：每次重试等待时间翻倍。如果没有这个机制，故障服务器会以全速接收重试风暴 — 使恢复变得不可能。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  await startRequest();
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Retry with Backoff', '交互式 Retry Backoff') }}</div>

    <!-- Failure rate slider -->
    <div class="rb-config">
      <label class="rb-slider-label">
        <span class="viz-label">{{ t('Failure Rate:', '失败率：') }}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          v-model.number="failureRate"
          :disabled="running"
          class="rb-slider"
        />
        <span class="rb-slider-value">{{ failureRate }}%</span>
      </label>
      <div class="rb-config-info">
        <span class="viz-label">{{ t('Base delay:', '基础延迟：') }} {{ BASE_DELAY / 1000 }}s</span>
        <span class="viz-label">{{ t('Max retries:', '最大重试：') }} {{ MAX_RETRIES }}</span>
      </div>
    </div>

    <!-- Formula display -->
    <div class="rb-formula">
      delay = min(base &times; 2<sup>attempt</sup>, cap) &plusmn; random jitter
    </div>

    <!-- Attempt timeline -->
    <div v-if="attempts.length" class="rb-timeline">
      <div
        v-for="attempt in attempts"
        :key="attempt.number"
        class="rb-attempt"
        :class="{
          'rb-attempt--success': attempt.result === 'success',
          'rb-attempt--fail': attempt.result === 'fail',
          'rb-attempt--waiting': attempt.result === 'waiting',
          'rb-attempt--pending': attempt.result === 'pending',
        }"
      >
        <div class="rb-attempt-header">
          <span class="rb-attempt-num">#{{ attempt.number }}</span>
          <span
            class="rb-attempt-badge"
            :style="{ background: barColor(attempt.result) }"
          >{{ resultLabel(attempt.result) }}</span>
        </div>

        <!-- Delay bar -->
        <div class="rb-bar-track">
          <div
            class="rb-bar-fill"
            :style="{
              width: barWidth(attempt),
              background: barColor(attempt.result),
            }"
          ></div>
        </div>

        <div class="rb-attempt-detail">
          <span v-if="attempt.number === 1" class="viz-label">{{ t('No delay (first attempt)', '无延迟（首次尝试）') }}</span>
          <span v-else class="viz-label">
            {{ attempt.delay }}ms
            <span class="rb-jitter">{{ attempt.jitter >= 0 ? '+' : '' }}{{ attempt.jitter }}ms {{ t('jitter', '抖动') }}</span>
            = {{ attempt.totalDelay }}ms
          </span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="rb-empty">
      <svg viewBox="0 0 200 80" class="rb-empty-svg">
        <text x="100" y="20" text-anchor="middle" fill="var(--viz-muted)" font-size="11">{{ t('Retry timeline will appear here', '重试时间线将在此显示') }}</text>
        <g v-for="i in 5" :key="i">
          <rect
            :x="10 + (i - 1) * 38"
            y="35"
            width="32"
            height="8"
            rx="3"
            fill="var(--viz-cell-empty)"
            opacity="0.5"
          />
          <text
            :x="26 + (i - 1) * 38"
            y="58"
            text-anchor="middle"
            fill="var(--viz-muted)"
            font-size="8"
          >#{{ i }}</text>
        </g>
      </svg>
    </div>

    <!-- Summary -->
    <div v-if="attempts.length && !running" class="rb-summary">
      <span class="viz-label">
        {{ t('Total attempts:', '总尝试：') }} {{ attempts.length }} |
        {{ t('Total wait:', '总等待：') }} {{ timelineTotalMs }}ms |
        {{ t('Outcome:', '结果：') }}
        <strong :style="{ color: finalOutcome === 'success' ? 'var(--viz-success)' : 'var(--viz-danger)' }">
          {{ finalOutcome === 'success' ? t('Succeeded', '成功') : t('Exhausted', '已耗尽') }}
        </strong>
      </span>
    </div>

    <!-- Controls -->
    <div class="viz-controls">
      <button
        class="viz-btn viz-btn--primary"
        @click="startRequest"
        :disabled="running"
      >
        {{ running ? t('Running...', '运行中...') : t('Send Request', '发送请求') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetGuaranteedFail">{{ t('All Fail', '全部失败') }}</button>
      <button class="viz-btn" @click="presetFlaky">{{ t('Flaky Network', '不稳定网络') }}</button>
      <button class="viz-btn" @click="presetNoBackoff">{{ t('Exponential Growth', '指数增长') }}</button>
    </div>

    <div class="viz-status" :style="{ borderLeft: `3px solid ${statusBorderColor}` }">
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.rb-config {
  margin-bottom: 0.75rem;
}

.rb-slider-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rb-slider {
  flex: 1;
  max-width: 200px;
  height: 4px;
  accent-color: var(--viz-primary);
  cursor: pointer;
}

.rb-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rb-slider-value {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--viz-text);
  min-width: 3rem;
}

.rb-config-info {
  display: flex;
  gap: 1rem;
  margin-top: 0.25rem;
}

.rb-formula {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--viz-muted);
  background: var(--vp-c-bg);
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
  margin-bottom: 1rem;
  text-align: center;
}

.rb-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.rb-attempt {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  padding: 0.5rem 0.625rem;
  background: var(--vp-c-bg);
  animation: viz-slide-in 0.3s ease;
}

.rb-attempt--success {
  border-color: var(--viz-success);
}

.rb-attempt--fail {
  border-color: var(--viz-danger);
}

.rb-attempt--waiting {
  border-color: var(--viz-warning);
  animation: viz-pulse 1s ease infinite;
}

.rb-attempt--pending {
  border-color: var(--viz-primary);
  animation: viz-pulse 0.6s ease infinite;
}

.rb-attempt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.rb-attempt-num {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--viz-text);
}

.rb-attempt-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #fff;
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
  letter-spacing: 0.03em;
}

.rb-bar-track {
  height: 6px;
  background: var(--viz-cell-empty);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.rb-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.rb-attempt-detail {
  display: flex;
  align-items: center;
}

.rb-jitter {
  color: var(--viz-warning);
  font-weight: 600;
}

.rb-empty {
  text-align: center;
  padding: 0.5rem 0;
}

.rb-empty-svg {
  width: 100%;
  max-width: 280px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.rb-summary {
  padding: 0.375rem 0;
  border-top: 1px solid var(--viz-border);
  margin-top: 0.25rem;
}
</style>
