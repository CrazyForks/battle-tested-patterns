<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

type MiddlewareBehavior = 'pass' | 'reject';

interface Middleware {
  name: string;
  label: { en: string; zh: string };
  color: string;
  enabled: boolean;
  behavior: MiddlewareBehavior;
  /** Whether the user can toggle behavior (Handler always passes) */
  configurable: boolean;
  /** Description shown in the config panel */
  desc: { en: string; zh: string };
}

const middlewares = reactive<Middleware[]>([
  {
    name: 'Auth',
    label: { en: 'Auth', zh: '认证' },
    color: 'var(--viz-primary)',
    enabled: true,
    behavior: 'pass',
    configurable: true,
    desc: { en: 'Checks authentication token', zh: '检查认证令牌' },
  },
  {
    name: 'RateLimit',
    label: { en: 'RateLimit', zh: '限流' },
    color: 'var(--viz-warning)',
    enabled: true,
    behavior: 'pass',
    configurable: true,
    desc: { en: 'Enforces request rate limits', zh: '执行请求频率限制' },
  },
  {
    name: 'Logger',
    label: { en: 'Logger', zh: '日志' },
    color: 'var(--viz-success)',
    enabled: true,
    behavior: 'pass',
    configurable: false,
    desc: { en: 'Logs request (always passes)', zh: '记录请求（始终通过）' },
  },
  {
    name: 'Validator',
    label: { en: 'Validator', zh: '校验' },
    color: '#8b5cf6',
    enabled: true,
    behavior: 'pass',
    configurable: true,
    desc: { en: 'Validates request body', zh: '验证请求体' },
  },
  {
    name: 'Handler',
    label: { en: 'Handler', zh: '处理器' },
    color: 'var(--viz-danger)',
    enabled: true,
    behavior: 'pass',
    configurable: false,
    desc: { en: 'Processes the request', zh: '处理请求' },
  },
]);

const activeIdx = ref(-1);
const phase = ref<'idle' | 'forward' | 'backward'>('idle');
const running = ref(false);
const rejected = ref(false);
const rejectAt = ref(-1);
const requestCount = ref(0);

interface LogEntry {
  text: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

const log = ref<LogEntry[]>([]);
const message = ref(t(
  'Configure middleware and click "Send Request"',
  '配置 Middleware 后点击「发送请求」'
));

const enabledCount = computed(() => middlewares.filter(m => m.enabled).length);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addLog(text: string, type: LogEntry['type'] = 'info') {
  log.value.push({ text, type });
  if (log.value.length > 30) {
    log.value = log.value.slice(-30);
  }
}

async function sendRequest() {
  if (running.value) return;
  running.value = true;
  rejected.value = false;
  rejectAt.value = -1;
  requestCount.value++;
  phase.value = 'forward';

  const reqNum = requestCount.value;
  addLog(t(`[#${reqNum}] Request entering chain...`, `[#${reqNum}] 请求进入链...`), 'info');
  message.value = t('Request entering middleware chain...', '请求正在进入 Middleware 链...');

  // Forward phase — go through each enabled middleware
  for (let i = 0; i < middlewares.length; i++) {
    const m = middlewares[i];
    if (!m.enabled) continue;

    activeIdx.value = i;
    message.value = t(
      `>> ${m.name}: processing request...`,
      `>> ${m.name}: 正在处理请求...`
    );
    await delay(450);

    // Check if this middleware rejects
    if (m.behavior === 'reject') {
      rejected.value = true;
      rejectAt.value = i;
      addLog(
        t(`[#${reqNum}] ${m.name}: REJECTED`, `[#${reqNum}] ${m.name}: 已拒绝`),
        'error'
      );
      message.value = t(
        `X ${m.name}: REJECTED the request`,
        `X ${m.name}: 拒绝了请求`
      );
      await delay(500);
      break;
    }

    // Middleware passes
    if (m.name === 'Logger') {
      addLog(
        t(`[#${reqNum}] ${m.name}: logged request`, `[#${reqNum}] ${m.name}: 已记录请求`),
        'warn'
      );
    } else {
      addLog(
        t(`[#${reqNum}] ${m.name}: passed`, `[#${reqNum}] ${m.name}: 通过`),
        'success'
      );
    }
  }

  // Backward phase — response flows back
  phase.value = 'backward';
  if (!rejected.value) {
    addLog(
      t(`[#${reqNum}] Handler done — response flowing back`, `[#${reqNum}] 处理完成 — 响应返回中`),
      'info'
    );
    message.value = t('Response flowing back through chain...', '响应正在沿链路返回...');
    await delay(300);
  }

  const startFrom = rejected.value ? rejectAt.value : middlewares.length - 1;
  for (let i = startFrom; i >= 0; i--) {
    const m = middlewares[i];
    if (!m.enabled) continue;
    activeIdx.value = i;

    if (m.name === 'Logger') {
      addLog(
        t(
          `[#${reqNum}] ${m.name}: logged response (${rejected.value ? 'error' : 'ok'})`,
          `[#${reqNum}] ${m.name}: 已记录响应 (${rejected.value ? '错误' : '正常'})`
        ),
        'warn'
      );
    }

    message.value = t(
      `<< ${m.name}: ${rejected.value ? 'forwarding error' : 'adding headers'}...`,
      `<< ${m.name}: ${rejected.value ? '转发错误' : '添加响应头'}...`
    );
    await delay(350);
  }

  // Done
  activeIdx.value = -1;
  phase.value = 'idle';
  if (rejected.value) {
    const rejectedName = middlewares[rejectAt.value].name;
    message.value = t(
      `Request #${reqNum} rejected by ${rejectedName}`,
      `请求 #${reqNum} 被 ${rejectedName} 拒绝`
    );
    addLog(
      t(`[#${reqNum}] DONE — rejected by ${rejectedName}`, `[#${reqNum}] 完成 — 被 ${rejectedName} 拒绝`),
      'error'
    );
  } else {
    message.value = t(
      `Request #${reqNum} completed successfully`,
      `请求 #${reqNum} 成功完成`
    );
    addLog(
      t(`[#${reqNum}] DONE — 200 OK`, `[#${reqNum}] 完成 — 200 OK`),
      'success'
    );
  }
  running.value = false;
}

function toggleEnabled(idx: number) {
  if (running.value) return;
  const m = middlewares[idx];
  // Handler cannot be disabled
  if (m.name === 'Handler') {
    message.value = t('Handler cannot be disabled', 'Handler 不能被禁用');
    return;
  }
  m.enabled = !m.enabled;
  message.value = t(
    `${m.name} ${m.enabled ? 'enabled' : 'disabled'}`,
    `${m.name} ${m.enabled ? '已启用' : '已禁用'}`
  );
}

function toggleBehavior(idx: number) {
  if (running.value) return;
  const m = middlewares[idx];
  if (!m.configurable) return;
  m.behavior = m.behavior === 'pass' ? 'reject' : 'pass';
  message.value = t(
    `${m.name} will ${m.behavior === 'pass' ? 'PASS' : 'REJECT'} requests`,
    `${m.name} 将${m.behavior === 'pass' ? '通过' : '拒绝'}请求`
  );
}

function reset() {
  activeIdx.value = -1;
  phase.value = 'idle';
  running.value = false;
  rejected.value = false;
  rejectAt.value = -1;
  requestCount.value = 0;
  log.value = [];
  middlewares.forEach(m => {
    m.enabled = true;
    m.behavior = 'pass';
  });
  message.value = t(
    'Reset — configure middleware and send a request',
    '已重置 — 配置 Middleware 后发送请求'
  );
}

function clearLog() {
  log.value = [];
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Middleware Chain', '交互式 Middleware 链') }}</div>

    <!-- Configuration panel -->
    <div class="mw-config-panel">
      <div class="mw-config-header">
        <span class="viz-label">{{ t('Middleware Pipeline', 'Middleware 管道') }}</span>
        <span class="mw-config-count">{{ enabledCount }}/{{ middlewares.length }} {{ t('active', '启用') }}</span>
      </div>

      <div class="mw-config-list">
        <div
          v-for="(m, i) in middlewares"
          :key="m.name"
          class="mw-config-item"
          :class="{ 'mw-config-item-disabled': !m.enabled }"
        >
          <!-- Toggle switch for enable/disable -->
          <label class="mw-toggle" :class="{ 'mw-toggle-disabled': running || m.name === 'Handler' }">
            <input
              type="checkbox"
              :checked="m.enabled"
              :disabled="running || m.name === 'Handler'"
              @change="toggleEnabled(i)"
            />
            <span class="mw-toggle-slider" :style="m.enabled ? { background: m.color } : {}"></span>
          </label>

          <span class="mw-config-name" :style="{ color: m.enabled ? m.color : 'var(--viz-muted)' }">
            {{ m.name }}
          </span>
          <span class="mw-config-desc">{{ t(m.desc.en, m.desc.zh) }}</span>

          <!-- Behavior toggle (pass/reject) for configurable middleware -->
          <button
            v-if="m.configurable && m.enabled"
            class="mw-behavior-btn"
            :class="m.behavior === 'reject' ? 'mw-behavior-reject' : 'mw-behavior-pass'"
            :disabled="running"
            @click="toggleBehavior(i)"
          >
            {{ m.behavior === 'pass' ? t('Pass', '通过') : t('Reject', '拒绝') }}
          </button>
          <span v-else-if="m.enabled" class="mw-behavior-fixed">
            {{ t('Pass', '通过') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Visual chain -->
    <div class="mw-chain">
      <div class="mw-endpoint" :class="{ 'mw-endpoint-active': phase === 'forward' }">
        <span class="mw-endpoint-icon">REQ</span>
        <span class="mw-endpoint-label">#{{ requestCount || '?' }}</span>
      </div>

      <template v-for="(m, i) in middlewares" :key="'chain-' + m.name">
        <div
          class="mw-arrow"
          :class="{ 'mw-arrow-active': activeIdx === i, 'mw-arrow-dim': !m.enabled }"
        >
          {{ !m.enabled ? '  ' : (phase === 'backward' && activeIdx <= i ? '<<' : '>>') }}
        </div>
        <div
          class="mw-node"
          :class="{
            'mw-node-active': activeIdx === i,
            'mw-node-disabled': !m.enabled,
            'mw-node-rejected': rejected && rejectAt === i,
            'mw-node-will-reject': m.behavior === 'reject' && m.enabled && phase === 'idle',
          }"
          :style="{ borderColor: m.enabled ? m.color : 'var(--viz-border)' }"
        >
          <div class="mw-node-name" :style="{ color: m.enabled ? m.color : 'var(--viz-muted)' }">
            {{ m.name }}
          </div>
          <div v-if="!m.enabled" class="mw-node-badge mw-node-skip">{{ t('OFF', '关') }}</div>
          <div v-else-if="m.behavior === 'reject'" class="mw-node-badge mw-node-badge-reject">{{ t('DENY', '拒') }}</div>
          <div v-else class="mw-node-badge mw-node-badge-pass">{{ t('OK', '通') }}</div>
        </div>
      </template>

      <div class="mw-arrow" :class="{ 'mw-arrow-active': phase === 'backward' && !rejected }">
        {{ phase === 'backward' ? '<<' : '>>' }}
      </div>
      <div
        class="mw-endpoint"
        :class="{
          'mw-endpoint-active': phase === 'backward' && !rejected,
          'mw-endpoint-error': phase === 'backward' && rejected,
        }"
      >
        <span class="mw-endpoint-icon">{{ rejected ? 'ERR' : 'RES' }}</span>
        <span class="mw-endpoint-label">{{ rejected ? '4xx' : '200' }}</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" :disabled="running" @click="sendRequest">
        {{ t('Send Request', '发送请求') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">
        {{ t('Reset', '重置') }}
      </button>
      <button v-if="log.length > 0" class="viz-btn" @click="clearLog">
        {{ t('Clear Log', '清除日志') }}
      </button>
    </div>

    <div class="viz-status">{{ message }}</div>

    <!-- Execution log -->
    <div v-if="log.length > 0" class="mw-log">
      <div class="mw-log-header">
        <span class="viz-label">{{ t('Execution Log', '执行日志') }}</span>
      </div>
      <div class="mw-log-entries" ref="logContainer">
        <div
          v-for="(entry, i) in log"
          :key="i"
          class="mw-log-entry"
          :class="'mw-log-' + entry.type"
        >{{ entry.text }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- Configuration panel ---- */
.mw-config-panel {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  padding: 0.6rem;
  margin-bottom: 0.8rem;
  background: var(--vp-c-bg);
}

.mw-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.mw-config-count {
  font-size: 0.7rem;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
}

.mw-config-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mw-config-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  background: var(--viz-bg);
  transition: opacity 0.2s;
}

.mw-config-item-disabled {
  opacity: 0.5;
}

.mw-config-name {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  min-width: 70px;
}

.mw-config-desc {
  font-size: 0.65rem;
  color: var(--viz-muted);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Toggle switch ---- */
.mw-toggle {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}

.mw-toggle-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.mw-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.mw-toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--viz-border);
  border-radius: 18px;
  transition: background 0.2s;
}

.mw-toggle-slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  bottom: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.mw-toggle input:checked + .mw-toggle-slider::before {
  transform: translateX(14px);
}

/* ---- Behavior toggle button ---- */
.mw-behavior-btn {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--vp-c-bg);
}

.mw-behavior-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.mw-behavior-pass {
  color: var(--viz-success);
  border-color: var(--viz-success);
}

.mw-behavior-pass:hover:not(:disabled) {
  background: var(--viz-success);
  color: #fff;
}

.mw-behavior-reject {
  border-color: var(--viz-danger);
  background: var(--viz-danger);
  color: #fff;
}

.mw-behavior-reject:hover:not(:disabled) {
  opacity: 0.85;
}

.mw-behavior-fixed {
  flex-shrink: 0;
  padding: 1px 8px;
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
}

/* ---- Visual chain ---- */
.mw-chain {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.8rem 0;
  overflow-x: auto;
  justify-content: center;
}

@media (max-width: 640px) {
  .mw-chain {
    flex-wrap: wrap;
    justify-content: center;
  }
}

.mw-endpoint {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 2px solid var(--viz-border);
  background: var(--vp-c-bg);
  transition: all 0.2s;
}

.mw-endpoint-icon {
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.mw-endpoint-label {
  font-size: 0.55rem;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
}

.mw-endpoint-active {
  border-color: var(--viz-primary);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
}

.mw-endpoint-error {
  border-color: var(--viz-danger);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
}

.mw-arrow {
  font-size: 0.75rem;
  color: var(--viz-muted);
  transition: color 0.2s;
  min-width: 16px;
  text-align: center;
  font-family: var(--vp-font-family-mono);
  font-weight: 700;
}

.mw-arrow-active {
  color: var(--viz-warning);
}

.mw-arrow-dim {
  opacity: 0.25;
}

.mw-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.4rem 0.5rem;
  border: 2px solid;
  border-radius: 8px;
  background: var(--vp-c-bg);
  transition: all 0.2s;
  min-width: 52px;
}

.mw-node-active {
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
  transform: scale(1.08);
}

.mw-node-disabled {
  opacity: 0.35;
}

.mw-node-rejected {
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.5) !important;
  animation: mw-shake 0.3s ease;
}

.mw-node-will-reject {
  border-style: dashed;
}

.mw-node-name {
  font-size: 0.65rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
}

.mw-node-badge {
  font-size: 0.5rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  padding: 0 4px;
  border-radius: 2px;
  line-height: 1.4;
}

.mw-node-skip {
  color: var(--viz-muted);
}

.mw-node-badge-pass {
  color: var(--viz-success);
}

.mw-node-badge-reject {
  color: #fff;
  background: var(--viz-danger);
  border-radius: 3px;
}

/* ---- Execution log ---- */
.mw-log {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  margin-top: 0.6rem;
  overflow: hidden;
}

.mw-log-header {
  padding: 0.3rem 0.6rem;
  border-bottom: 1px solid var(--viz-border);
  background: var(--viz-bg);
}

.mw-log-entries {
  max-height: 140px;
  overflow-y: auto;
  padding: 0.3rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mw-log-entry {
  font-size: 0.65rem;
  font-family: var(--vp-font-family-mono);
  padding: 1px 4px;
  border-radius: 2px;
  line-height: 1.5;
}

.mw-log-info {
  color: var(--viz-text);
}

.mw-log-success {
  color: var(--viz-success);
}

.mw-log-error {
  color: var(--viz-danger);
  font-weight: 600;
}

.mw-log-warn {
  color: var(--viz-warning);
}

@keyframes mw-shake {
  0%, 100% { transform: translateX(0) scale(1.08); }
  25% { transform: translateX(-3px) scale(1.08); }
  75% { transform: translateX(3px) scale(1.08); }
}
</style>
