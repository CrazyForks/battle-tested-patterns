<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const state = ref<State>('CLOSED');
const failureCount = ref(0);
const successCount = ref(0);
const threshold = 3;
// HALF_OPEN allows exactly ONE probe call; a single success closes the
// circuit (matches the pattern's state table and all language impls).
const halfOpenMax = 1;
const message = ref(
  t(
    'Circuit is CLOSED — all requests pass through. Try sending failures to trip the breaker!',
    '熔断器已关闭 — 所有请求正常通过。试试发送失败请求来触发熔断！',
  ),
);
const lastResult = ref<'success' | 'failure' | ''>('');
const requestLog = ref<{ type: 'success' | 'failure' | 'rejected'; id: number }[]>([]);
let reqId = 0;
let presetRunning = false;

type Snapshot = {
  state: State;
  failureCount: number;
  successCount: number;
  requestLog: { type: string; id: number }[];
};

const history = useVizHistory<Snapshot>(
  { state: 'CLOSED', failureCount: 0, successCount: 0, requestLog: [] },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      state.value = snap.state;
      failureCount.value = snap.failureCount;
      successCount.value = snap.successCount;
      requestLog.value = snap.requestLog as typeof requestLog.value;
      lastResult.value = '';
      if (msg !== undefined) message.value = msg;
    },
  },
);

const stateColor = computed(() => {
  switch (state.value) {
    case 'CLOSED':
      return 'var(--viz-success)';
    case 'OPEN':
      return 'var(--viz-danger)';
    case 'HALF_OPEN':
      return 'var(--viz-warning)';
    default:
      return 'var(--viz-success)';
  }
});

function sendSuccess() {
  if (state.value === 'OPEN') {
    requestLog.value.unshift({ type: 'rejected', id: ++reqId });
    message.value = t(
      'REJECTED — circuit is OPEN. In production, this fail-fast saves latency: no waiting for a timeout from a broken service.',
      '已拒绝 — 熔断器已打开。在生产中，快速失败节省了延迟：无需等待故障服务的超时。',
    );
    log(message.value, 'warning');
    lastResult.value = 'failure';
    cleanLog();
    history.commit(
      {
        state: state.value,
        failureCount: failureCount.value,
        successCount: successCount.value,
        requestLog: requestLog.value,
      },
      'success rejected (OPEN)',
    );
    return;
  }

  lastResult.value = 'success';
  requestLog.value.unshift({ type: 'success', id: ++reqId });

  if (state.value === 'HALF_OPEN') {
    successCount.value++;
    if (successCount.value >= halfOpenMax) {
      state.value = 'CLOSED';
      failureCount.value = 0;
      successCount.value = 0;
      message.value = t(
        'Probe call succeeded in HALF-OPEN → CLOSED! The single trial request confirmed the service recovered. Traffic resumes.',
        'HALF-OPEN 中探测调用成功 → 关闭！这一次试探请求确认服务已恢复，流量恢复。',
      );
      log(message.value, 'success');
    }
  } else {
    failureCount.value = 0;
    message.value = t(
      'Request succeeded — circuit stays CLOSED. Failure counter reset to 0/' + threshold + '.',
      '请求成功 — 熔断器保持关闭。失败计数器重置为 0/' + threshold + '。',
    );
    log(message.value, 'info');
  }
  cleanLog();
  history.commit(
    {
      state: state.value,
      failureCount: failureCount.value,
      successCount: successCount.value,
      requestLog: requestLog.value,
    },
    'send success',
  );
}

function sendFailure() {
  if (state.value === 'OPEN') {
    requestLog.value.unshift({ type: 'rejected', id: ++reqId });
    message.value = t(
      'REJECTED — circuit is OPEN. Request not even attempted. This prevents cascading failures across microservices.',
      '已拒绝 — 熔断器已打开。请求甚至未尝试发送。这防止了微服务间的级联故障。',
    );
    log(message.value, 'warning');
    lastResult.value = 'failure';
    cleanLog();
    history.commit(
      {
        state: state.value,
        failureCount: failureCount.value,
        successCount: successCount.value,
        requestLog: requestLog.value,
      },
      'failure rejected (OPEN)',
    );
    return;
  }

  lastResult.value = 'failure';
  requestLog.value.unshift({ type: 'failure', id: ++reqId });

  if (state.value === 'HALF_OPEN') {
    state.value = 'OPEN';
    successCount.value = 0;
    message.value = t(
      'Failure in HALF-OPEN → back to OPEN! One failure is enough to re-trip — the service is still unstable.',
      'HALF-OPEN 中失败 → 重新打开！一次失败就足以重新触发 — 服务仍不稳定。',
    );
    log(message.value, 'error');
  } else {
    failureCount.value++;
    if (failureCount.value >= threshold) {
      state.value = 'OPEN';
      message.value = t(
        `${threshold} failures reached → OPEN! All requests will be rejected instantly. Netflix Hystrix uses this exact pattern.`,
        `已达 ${threshold} 次失败 → 打开！所有请求将被立即拒绝。Netflix Hystrix 使用完全相同的模式。`,
      );
      log(message.value, 'error');
    } else {
      message.value = t(
        `Failure ${failureCount.value}/${threshold} — still CLOSED. ${threshold - failureCount.value} more failures will trip the circuit.`,
        `失败 ${failureCount.value}/${threshold} — 仍然关闭。再 ${threshold - failureCount.value} 次失败将触发熔断。`,
      );
      log(message.value, 'warning');
    }
  }
  cleanLog();
  history.commit(
    {
      state: state.value,
      failureCount: failureCount.value,
      successCount: successCount.value,
      requestLog: requestLog.value,
    },
    'send failure',
  );
}

function tryReset() {
  if (state.value !== 'OPEN') {
    message.value = t('Circuit is not OPEN — no timeout needed.', '熔断器未打开 — 无需超时重置。');
    return;
  }
  state.value = 'HALF_OPEN';
  successCount.value = 0;
  message.value = t(
    'Timeout expired → HALF-OPEN. Next request is a probe: one success starts recovery, one failure re-trips.',
    '超时到期 → HALF-OPEN。下一个请求是探测：一次成功开始恢复，一次失败重新触发。',
  );
  log(message.value, 'highlight');
  history.commit(
    {
      state: state.value,
      failureCount: failureCount.value,
      successCount: successCount.value,
      requestLog: requestLog.value,
    },
    'timeout reset → HALF_OPEN',
  );
}

function reset() {
  clearAll();
  state.value = 'CLOSED';
  failureCount.value = 0;
  successCount.value = 0;
  requestLog.value = [];
  lastResult.value = '';
  presetRunning = false;
  message.value = t('Reset! Circuit is CLOSED.', '已重置！熔断器已关闭。');
  clearLog();
  history.reset();
}

function cleanLog() {
  if (requestLog.value.length > 12) requestLog.value = requestLog.value.slice(0, 12);
}

async function presetCascadingFailure() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const steps: Array<() => void> = [
    () => sendFailure(),
    () => sendFailure(),
    () => sendFailure(),
    () => sendSuccess(),
    () => tryReset(),
    () => sendFailure(),
    () => sendSuccess(),
  ];
  for (const step of steps) {
    if (!presetRunning || isAborted()) return;
    await delay(900);
    if (!presetRunning || isAborted()) return;
    step();
  }
  log(
    t(
      'Circuit breaker prevents cascading failures by failing fast when a downstream service is unhealthy.',
      '断路器通过在下游服务不健康时快速失败来防止级联故障。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetRecovery() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const steps: Array<() => void> = [
    () => sendFailure(),
    () => sendFailure(),
    () => sendFailure(),
    () => tryReset(),
    () => sendSuccess(),
    () => sendSuccess(),
    () => sendSuccess(),
  ];
  for (const step of steps) {
    if (!presetRunning || isAborted()) return;
    await delay(900);
    if (!presetRunning || isAborted()) return;
    step();
  }
  log(
    t(
      'Half-open state uses probe requests to safely test recovery before restoring full traffic.',
      '半开状态使用探测请求在恢复全部流量前安全地测试恢复。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetHealthy() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const steps: Array<() => void> = [
    () => sendSuccess(),
    () => sendSuccess(),
    () => sendFailure(),
    () => sendSuccess(),
    () => sendSuccess(),
    () => sendSuccess(),
  ];
  for (const step of steps) {
    if (!presetRunning || isAborted()) return;
    await delay(700);
    if (!presetRunning || isAborted()) return;
    step();
  }
  log(
    t(
      'Under normal load, the circuit stays closed and failure counter resets — zero overhead on the happy path.',
      '正常负载下，断路器保持关闭且故障计数器重置 — 正常路径零开销。',
    ),
    'highlight',
  );
  presetRunning = false;
}

const states: { key: State; label: string; x: number; y: number }[] = [
  { key: 'CLOSED', label: 'Closed', x: 60, y: 60 },
  { key: 'OPEN', label: 'Open', x: 240, y: 60 },
  { key: 'HALF_OPEN', label: 'Half-Open', x: 150, y: 160 },
];
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">
      {{ t('Interactive Circuit Breaker', '交互式 Circuit Breaker') }} ·
      {{ t('threshold', '阈值') }}={{ threshold }}
    </div>

    <!-- State machine diagram -->
    <svg
      viewBox="0 0 300 200"
      class="cb-svg"
      role="img"
      :aria-label="t('Circuit breaker state diagram', '断路器状态图')"
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="var(--viz-muted)" />
        </marker>
      </defs>

      <line
        x1="95"
        y1="55"
        x2="200"
        y2="55"
        stroke="var(--viz-muted)"
        stroke-width="1.5"
        marker-end="url(#arrow)"
        stroke-dasharray="4,3"
      />
      <text x="148" y="46" text-anchor="middle" fill="var(--viz-muted)" font-size="8">
        {{ threshold }} {{ t('failures', '次失败') }}
      </text>

      <line
        x1="225"
        y1="85"
        x2="175"
        y2="140"
        stroke="var(--viz-muted)"
        stroke-width="1.5"
        marker-end="url(#arrow)"
        stroke-dasharray="4,3"
      />
      <text x="210" y="118" text-anchor="middle" fill="var(--viz-muted)" font-size="8">
        {{ t('timeout', '超时') }}
      </text>

      <line
        x1="120"
        y1="148"
        x2="72"
        y2="90"
        stroke="var(--viz-muted)"
        stroke-width="1.5"
        marker-end="url(#arrow)"
        stroke-dasharray="4,3"
      />
      <text x="82" y="126" text-anchor="middle" fill="var(--viz-muted)" font-size="8">
        {{ t('success', '成功') }}
      </text>

      <line
        x1="180"
        y1="148"
        x2="228"
        y2="90"
        stroke="var(--viz-muted)"
        stroke-width="1.5"
        marker-end="url(#arrow)"
        stroke-dasharray="4,3"
      />
      <text x="218" y="130" text-anchor="middle" fill="var(--viz-muted)" font-size="8">
        {{ t('failure', '失败') }}
      </text>

      <g v-for="s in states" :key="s.key">
        <circle
          :cx="s.x"
          :cy="s.y"
          r="30"
          :fill="state === s.key ? stateColor : 'var(--vp-c-bg)'"
          :stroke="state === s.key ? stateColor : 'var(--viz-border)'"
          stroke-width="2"
          :class="{ 'cb-active': state === s.key }"
        />
        <text
          :x="s.x"
          :y="s.y + 1"
          text-anchor="middle"
          dominant-baseline="central"
          :fill="state === s.key ? '#fff' : 'var(--viz-text)'"
          font-size="10"
          font-weight="600"
        >
          {{ s.label }}
        </text>
      </g>
    </svg>

    <!-- Request log -->
    <div v-if="requestLog.length" class="cb-log">
      <span
        v-for="entry in requestLog"
        :key="entry.id"
        class="cb-log-dot"
        :class="{
          'cb-log-dot--success': entry.type === 'success',
          'cb-log-dot--failure': entry.type === 'failure',
          'cb-log-dot--rejected': entry.type === 'rejected',
        }"
        :title="entry.type"
      ></span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="sendSuccess">
        {{ t('Send Success', '发送成功') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="sendFailure">
        {{ t('Send Failure', '发送失败') }}
      </button>
      <button class="viz-btn" @click="tryReset" :disabled="state !== 'OPEN'">
        {{ t('Timeout Reset', '超时重置') }}
      </button>
      <button class="viz-btn" @click="reset">{{ t('Reset All', '全部重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetCascadingFailure">
        {{ t('Cascading Failure', '级联故障') }}
      </button>
      <button class="viz-btn" @click="presetRecovery">{{ t('Recovery', '恢复') }}</button>
      <button class="viz-btn" @click="presetHealthy">{{ t('Healthy Service', '健康服务') }}</button>
    </div>

    <div class="viz-status" aria-live="polite" :style="{ borderLeft: `3px solid ${stateColor}` }">
      {{ message }}
    </div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.cb-svg {
  width: 100%;
  max-width: 320px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.cb-active {
  animation: viz-pulse 0.5s ease;
}

.cb-log {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 0.5rem 0;
}

.cb-log-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition: all var(--viz-transition);
}

.cb-log-dot--success {
  background: var(--viz-success);
}

.cb-log-dot--failure {
  background: var(--viz-danger);
}

.cb-log-dot--rejected {
  background: var(--viz-muted);
  border: 1px dashed var(--viz-danger);
}
</style>
