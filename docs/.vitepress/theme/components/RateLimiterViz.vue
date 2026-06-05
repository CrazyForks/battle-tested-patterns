<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import VizLog from './VizLog.vue';

const { t } = useI18n();
const { safeInterval, safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const capacity = 8;
const refillRate = 2;
const tokens = ref(capacity);
const requestLog = ref<{ time: number; accepted: boolean }[]>([]);
const message = ref(t(
  'Click "Send Request" to consume tokens — this is the token bucket algorithm used by Nginx, API Gateway, and Stripe\'s API rate limiting',
  '点击"发送请求"消耗令牌 — 这是 Nginx、API Gateway 和 Stripe API 限流使用的令牌桶算法'
));
const running = ref(false);
let presetRunning = false;

function startRefill() {
  if (running.value) return;
  running.value = true;
  safeInterval(() => {
    if (tokens.value < capacity) {
      tokens.value = Math.min(capacity, tokens.value + 1);
    }
  }, 1000 / refillRate);
  message.value = t(`Auto-refilling at ${refillRate} tokens/sec`, `自动补充中，${refillRate} 令牌/秒`);
}

function stopRefill() {
  clearAll();
  running.value = false;
  message.value = t('Auto-refill stopped', '自动补充已停止');
}

function sendRequest() {
  const now = Date.now();
  if (tokens.value > 0) {
    tokens.value--;
    requestLog.value.push({ time: now, accepted: true });
    message.value = t(`Request accepted (${tokens.value} tokens left)`, `请求已接受（剩余 ${tokens.value} 令牌）`);
    log(message.value, 'success');
  } else {
    requestLog.value.push({ time: now, accepted: false });
    message.value = t('Request REJECTED — bucket empty!', '请求被拒绝 — 令牌桶为空！');
    log(message.value, 'error');
  }
  if (requestLog.value.length > 20) {
    requestLog.value = requestLog.value.slice(-20);
  }
}

function sendBurst() {
  for (let i = 0; i < 5; i++) {
    safeTimeout(() => sendRequest(), i * 80);
  }
}

function reset() {
  clearAll();
  running.value = false;
  presetRunning = false;
  tokens.value = capacity;
  requestLog.value = [];
  message.value = t('Bucket refilled to capacity', '令牌桶已补满');
  clearLog();
}

function tokenColor(i: number) {
  if (i < tokens.value) return 'var(--viz-primary)';
  return 'var(--viz-cell-empty)';
}

async function presetBurstAndRecover() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Burst and recover: send 10 requests rapidly, then watch tokens refill. The bucket absorbs bursts up to capacity, then rejects — this is how token bucket differs from fixed-window rate limiting.',
    '突发与恢复：快速发送 10 个请求，然后观察令牌补充。桶吸收最多容量的突发，然后拒绝 — 这就是令牌桶与固定窗口限流的区别。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 10; i++) {
    if (!presetRunning || isAborted()) return;
    sendRequest();
    await delay(100);
  }
  await delay(400);
  if (!presetRunning || isAborted()) return;
  startRefill();
  message.value = t(
    '8 accepted, 2 rejected. Now refilling at 2/sec. In 4 seconds the bucket will be full again. Stripe\'s API allows bursts of 25 requests, then refills at 25/sec — generous for integration testing, strict for abuse.',
    '8 个接受，2 个拒绝。现在以 2/秒补充。4 秒后桶将再次满。Stripe API 允许 25 个请求的突发，然后以 25/秒补充 — 对集成测试宽松，对滥用严格。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetSteadyState() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  startRefill();
  message.value = t(
    'Steady state: refill running at 2/sec while sending 1 request/sec. Tokens stay stable because consumption < refill rate. This is normal API usage within rate limits.',
    '稳态：以 2/秒补充，同时每秒发送 1 个请求。令牌保持稳定因为消耗 < 补充速率。这是限流内的正常 API 使用。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 6; i++) {
    if (!presetRunning || isAborted()) return;
    sendRequest();
    await delay(1000);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'All 6 requests accepted — tokens never dropped below 7 because refill outpaces consumption. This is the ideal: clients stay within their quota and never see 429 Too Many Requests.',
    '全部 6 个请求被接受 — 令牌从未低于 7 因为补充速度超过消耗。这是理想状态：客户端保持在配额内，永远不会看到 429 Too Many Requests。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetDrainAndBlock() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Drain and block: empty the bucket completely, then try to send more. Every request after drain is rejected until refill starts. This models a DDoS scenario — attacker exhausts the bucket, legitimate requests get blocked.',
    '耗尽并阻塞：完全清空桶，然后尝试发送更多。耗尽后每个请求都被拒绝直到开始补充。这模拟了 DDoS 场景 — 攻击者耗尽桶，合法请求被阻塞。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 8; i++) {
    if (!presetRunning || isAborted()) return;
    sendRequest();
    await delay(50);
  }
  await delay(300);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 4; i++) {
    if (!presetRunning || isAborted()) return;
    sendRequest();
    await delay(200);
  }
  await delay(400);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Bucket drained — all subsequent requests rejected (HTTP 429). Solutions: per-IP buckets (Cloudflare), sliding window counters (Redis MULTI), or leaky bucket (constant drain rate). Nginx uses limit_req with burst parameter.',
    '桶已耗尽 — 所有后续请求被拒绝 (HTTP 429)。解决方案：按 IP 分桶 (Cloudflare)、滑动窗口计数器 (Redis MULTI)、或漏桶（恒定流出速率）。Nginx 使用 limit_req 的 burst 参数。'
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Token Bucket Rate Limiter', '交互式令牌桶 Rate Limiter') }}</div>

    <!-- Bucket visualization -->
    <div class="rl-bucket-wrap">
      <div class="rl-bucket-label">{{ tokens }}/{{ capacity }} {{ t('tokens', '令牌') }}</div>
      <svg :viewBox="`0 0 ${capacity * 32 + 16} 48`" class="rl-svg">
        <rect
          v-for="i in capacity"
          :key="i"
          :x="(i - 1) * 32 + 8"
          y="8"
          width="26"
          height="32"
          rx="4"
          :fill="tokenColor(i - 1)"
          stroke="var(--viz-border)"
          stroke-width="1"
          :class="{ 'rl-token-active': i - 1 < tokens }"
        />
        <text
          v-for="i in capacity"
          :key="'t' + i"
          :x="(i - 1) * 32 + 21"
          y="28"
          text-anchor="middle"
          dominant-baseline="central"
          :fill="i - 1 < tokens ? '#fff' : 'var(--viz-muted)'"
          font-size="11"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >{{ i - 1 < tokens ? '●' : '○' }}</text>
      </svg>
    </div>

    <!-- Request log -->
    <div v-if="requestLog.length > 0" class="rl-log">
      <span class="viz-label">{{ t('Requests:', '请求:') }}&nbsp;</span>
      <span
        v-for="(req, i) in requestLog.slice(-12)"
        :key="i"
        class="rl-log-dot"
        :class="req.accepted ? 'rl-dot-ok' : 'rl-dot-reject'"
        :title="req.accepted ? t('Accepted', '已接受') : t('Rejected', '已拒绝')"
      >{{ req.accepted ? '✓' : '✗' }}</span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="sendRequest">{{ t('Send Request', '发送请求') }}</button>
      <button class="viz-btn" @click="sendBurst">{{ t('Burst (×5)', '突发 (×5)') }}</button>
      <button v-if="!running" class="viz-btn" @click="startRefill">{{ t('Start Refill', '开始补充') }}</button>
      <button v-else class="viz-btn viz-btn--danger" @click="stopRefill">{{ t('Stop Refill', '停止补充') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetBurstAndRecover">{{ t('Burst & Recover', '突发恢复') }}</button>
      <button class="viz-btn" @click="presetSteadyState">{{ t('Steady State', '稳态') }}</button>
      <button class="viz-btn" @click="presetDrainAndBlock">{{ t('Drain & Block', '耗尽阻塞') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.rl-bucket-wrap {
  text-align: center;
  margin: 0.5rem 0;
}

.rl-bucket-label {
  font-size: 0.8rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  margin-bottom: 0.25rem;
}

.rl-svg {
  width: 100%;
  max-width: 320px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.rl-token-active {
  animation: viz-slide-in 0.2s ease;
}

.rl-log {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-wrap: wrap;
  padding: 0.5rem 0;
}

.rl-log-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 0.65rem;
  font-weight: 700;
}

.rl-dot-ok {
  background: var(--viz-success);
  color: #fff;
}

.rl-dot-reject {
  background: var(--viz-danger);
  color: #fff;
}
</style>
