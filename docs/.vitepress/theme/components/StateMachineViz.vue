<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

type State = 'idle' | 'loading' | 'success' | 'error';
type Event = 'FETCH' | 'RESOLVE' | 'REJECT' | 'RETRY' | 'RESET';

const transitions: Record<State, Partial<Record<Event, State>>> = {
  idle: { FETCH: 'loading' },
  loading: { RESOLVE: 'success', REJECT: 'error' },
  success: { RESET: 'idle' },
  error: { RETRY: 'loading' },
};

const currentState = ref<State>('idle');
const history = ref<{ from: State; event: Event; to: State }[]>([]);
const message = ref(t(
  'Click an event button to trigger a state transition — or pick a scenario to see real-world patterns',
  '点击事件按钮触发状态转换 — 或选择场景查看实际模式'
));
const lastTransition = ref<string>('');
let presetRunning = false;

const statePositions: Record<State, { x: number; y: number }> = {
  idle: { x: 80, y: 80 },
  loading: { x: 280, y: 80 },
  success: { x: 280, y: 200 },
  error: { x: 80, y: 200 },
};

const stateColors: Record<State, string> = {
  idle: 'var(--viz-muted)',
  loading: 'var(--viz-warning)',
  success: 'var(--viz-success)',
  error: 'var(--viz-danger)',
};

const availableEvents = computed<Event[]>(() => {
  const events = transitions[currentState.value];
  return Object.keys(events) as Event[];
});

const allEvents: Event[] = ['FETCH', 'RESOLVE', 'REJECT', 'RETRY', 'RESET'];

function triggerEvent(event: Event) {
  const nextState = transitions[currentState.value][event];
  if (!nextState) {
    message.value = t(
      `Cannot trigger ${event} from ${currentState.value.toUpperCase()} — invalid transitions are impossible by design, not caught at runtime.`,
      `无法从 ${currentState.value.toUpperCase()} 触发 ${event} — 无效转换在设计上就不可能发生，而非运行时捕获。`
    );
    return;
  }

  const from = currentState.value;
  currentState.value = nextState;
  lastTransition.value = `${from}-${event}-${nextState}`;
  history.value.push({ from, event, to: nextState });

  const explanations: Record<string, { en: string; zh: string }> = {
    'idle-FETCH-loading': {
      en: `IDLE → LOADING. The key insight: while loading, FETCH is invalid — prevents duplicate requests without needing a "isLoading" boolean.`,
      zh: `IDLE → LOADING。关键洞察：加载期间 FETCH 无效 — 无需 "isLoading" 布尔变量即可防止重复请求。`,
    },
    'loading-RESOLVE-success': {
      en: `LOADING → SUCCESS. Only LOADING can transition to SUCCESS — you can never reach SUCCESS from IDLE directly.`,
      zh: `LOADING → SUCCESS。只有 LOADING 能转换到 SUCCESS — 你永远无法直接从 IDLE 到达 SUCCESS。`,
    },
    'loading-REJECT-error': {
      en: `LOADING → ERROR. From ERROR, only RETRY is valid — users can't accidentally trigger FETCH on a broken request.`,
      zh: `LOADING → ERROR。从 ERROR 只有 RETRY 有效 — 用户不会意外地对一个失败请求触发 FETCH。`,
    },
    'error-RETRY-loading': {
      en: `ERROR → LOADING via RETRY. Unlike a free-form flag approach, the retry path is explicit and auditable.`,
      zh: `ERROR → LOADING（通过 RETRY）。与自由形式的标志方法不同，重试路径是显式且可审计的。`,
    },
    'success-RESET-idle': {
      en: `SUCCESS → IDLE via RESET. The full cycle is complete. Every state has exactly the transitions it needs — no more, no less.`,
      zh: `SUCCESS → IDLE（通过 RESET）。完整循环结束。每个状态恰好拥有所需的转换 — 不多不少。`,
    },
  };

  const key = `${from}-${event}-${nextState}`;
  const explanation = explanations[key];
  message.value = explanation ? t(explanation.en, explanation.zh) : t(
    `${from.toUpperCase()} —[${event}]→ ${nextState.toUpperCase()}`,
    `${from.toUpperCase()} —[${event}]→ ${nextState.toUpperCase()}`
  );

  if (history.value.length > 10) {
    history.value = history.value.slice(-10);
  }
}

function reset() {
  clearAll();
  currentState.value = 'idle';
  history.value = [];
  lastTransition.value = '';
  presetRunning = false;
  message.value = t('State machine reset to IDLE', '状态机已重置为 IDLE');
}

async function presetHappyPath() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const steps: { event: Event; msg: { en: string; zh: string } }[] = [
    { event: 'FETCH', msg: { en: 'User clicks "Load Data" — transition to LOADING.', zh: '用户点击"加载数据" — 转换到 LOADING。' } },
    { event: 'RESOLVE', msg: { en: 'API returns 200 OK — transition to SUCCESS. Data is displayed.', zh: 'API 返回 200 OK — 转换到 SUCCESS。数据已显示。' } },
    { event: 'RESET', msg: { en: 'User navigates away or clicks refresh — back to IDLE. Ready for next request.', zh: '用户导航离开或点击刷新 — 回到 IDLE。准备好处理下一个请求。' } },
  ];
  for (const step of steps) {
    if (!presetRunning || isAborted()) return;
    await delay(900);
    if (!presetRunning || isAborted()) return;
    message.value = t(step.msg.en, step.msg.zh);
    await delay(400);
    if (!presetRunning || isAborted()) return;
    triggerEvent(step.event);
  }
  message.value = t(
    'Happy path complete! The state machine guarantees this exact sequence. Compare with boolean flags: isLoading, isError, isSuccess — 8 possible combinations, most invalid.',
    '正常路径完成！状态机保证了这个精确序列。对比布尔标志：isLoading、isError、isSuccess — 8 种可能组合，大多数无效。'
  );
  presetRunning = false;
}

async function presetErrorRecovery() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const steps: { event: Event; msg: { en: string; zh: string } }[] = [
    { event: 'FETCH', msg: { en: 'First attempt — FETCH triggered.', zh: '第一次尝试 — 触发 FETCH。' } },
    { event: 'REJECT', msg: { en: 'Network error! API returns 500 — transition to ERROR.', zh: '网络错误！API 返回 500 — 转换到 ERROR。' } },
    { event: 'RETRY', msg: { en: 'User clicks "Retry" — back to LOADING. Second attempt.', zh: '用户点击"重试" — 回到 LOADING。第二次尝试。' } },
    { event: 'REJECT', msg: { en: 'Still failing! Another 500. Back to ERROR.', zh: '仍然失败！又一个 500。回到 ERROR。' } },
    { event: 'RETRY', msg: { en: 'Third attempt — RETRY again.', zh: '第三次尝试 — 再次 RETRY。' } },
    { event: 'RESOLVE', msg: { en: 'Success on third try! The retry loop is built into the state machine — no ad-hoc counter needed.', zh: '第三次成功！重试循环内置在状态机中 — 无需临时计数器。' } },
    { event: 'RESET', msg: { en: 'Done. Back to IDLE.', zh: '完成。回到 IDLE。' } },
  ];
  for (const step of steps) {
    if (!presetRunning || isAborted()) return;
    await delay(900);
    if (!presetRunning || isAborted()) return;
    message.value = t(step.msg.en, step.msg.zh);
    await delay(400);
    if (!presetRunning || isAborted()) return;
    triggerEvent(step.event);
  }
  message.value = t(
    'Error recovery complete! XState and Robot use this exact pattern. The ERROR→RETRY→LOADING loop is explicit — no "impossible state" bugs.',
    '错误恢复完成！XState 和 Robot 使用完全相同的模式。ERROR→RETRY→LOADING 循环是显式的 — 没有"不可能状态"的 bug。'
  );
  presetRunning = false;
}

async function presetImpossibleStates() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const attempts: { event: Event; valid: boolean; msg: { en: string; zh: string } }[] = [
    { event: 'RESOLVE', valid: false, msg: { en: 'Try RESOLVE from IDLE — blocked! You can\'t succeed without first loading.', zh: '尝试从 IDLE 触发 RESOLVE — 被阻止！你不能不加载就成功。' } },
    { event: 'RETRY', valid: false, msg: { en: 'Try RETRY from IDLE — blocked! Nothing to retry.', zh: '尝试从 IDLE 触发 RETRY — 被阻止！没有什么可重试的。' } },
    { event: 'FETCH', valid: true, msg: { en: 'FETCH from IDLE — valid! Now we\'re LOADING.', zh: 'IDLE 触发 FETCH — 有效！现在是 LOADING。' } },
    { event: 'FETCH', valid: false, msg: { en: 'Try FETCH while LOADING — blocked! Prevents duplicate requests. With booleans, this bug is easy to introduce.', zh: '加载时尝试 FETCH — 被阻止！防止重复请求。使用布尔值时，这种 bug 很容易引入。' } },
    { event: 'RESET', valid: false, msg: { en: 'Try RESET while LOADING — blocked! Can\'t cancel mid-flight in this model.', zh: '加载时尝试 RESET — 被阻止！在此模型中不能取消进行中的操作。' } },
    { event: 'RESOLVE', valid: true, msg: { en: 'RESOLVE — valid! Done loading.', zh: 'RESOLVE — 有效！加载完成。' } },
  ];
  for (const attempt of attempts) {
    if (!presetRunning || isAborted()) return;
    await delay(1000);
    if (!presetRunning || isAborted()) return;
    message.value = t(attempt.msg.en, attempt.msg.zh);
    if (attempt.valid) {
      await delay(400);
      if (!presetRunning || isAborted()) return;
      triggerEvent(attempt.event);
    }
  }
  message.value = t(
    'State machines make impossible states impossible. With 4 states and 5 events, only 5 transitions are valid out of 20 possible — 75% of bugs eliminated by design.',
    '状态机使不可能的状态变得不可能。4 个状态和 5 个事件，20 种可能中只有 5 种转换有效 — 设计上消除了 75% 的 bug。'
  );
  presetRunning = false;
}

const edgeData = [
  { from: 'idle', to: 'loading', event: 'FETCH', curve: 0 },
  { from: 'loading', to: 'success', event: 'RESOLVE', curve: 0 },
  { from: 'loading', to: 'error', event: 'REJECT', curve: -20 },
  { from: 'error', to: 'loading', event: 'RETRY', curve: 20 },
  { from: 'success', to: 'idle', event: 'RESET', curve: 0 },
] as const;

function edgePath(from: State, to: State, curve: number): string {
  const p1 = statePositions[from];
  const p2 = statePositions[to];
  const mx = (p1.x + p2.x) / 2 + curve;
  const my = (p1.y + p2.y) / 2 + curve;
  return `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
}

function edgeLabelPos(from: State, to: State, curve: number): { x: number; y: number } {
  const p1 = statePositions[from];
  const p2 = statePositions[to];
  return {
    x: (p1.x + p2.x) / 2 + curve * 0.7,
    y: (p1.y + p2.y) / 2 + curve * 0.7 - 8,
  };
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive State Machine', '交互式状态机') }}</div>

    <svg viewBox="0 0 380 280" class="sm-svg">
      <defs>
        <marker id="sm-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--viz-border)" />
        </marker>
        <marker id="sm-arrow-hl" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="var(--viz-warning)" />
        </marker>
      </defs>

      <!-- Edges -->
      <g v-for="edge in edgeData" :key="edge.event">
        <path
          :d="edgePath(edge.from as State, edge.to as State, edge.curve)"
          fill="none"
          :stroke="lastTransition === `${edge.from}-${edge.event}-${edge.to}` ? 'var(--viz-warning)' : 'var(--viz-border)'"
          :stroke-width="lastTransition === `${edge.from}-${edge.event}-${edge.to}` ? 2.5 : 1.5"
          :marker-end="lastTransition === `${edge.from}-${edge.event}-${edge.to}` ? 'url(#sm-arrow-hl)' : 'url(#sm-arrow)'"
        />
        <text
          :x="edgeLabelPos(edge.from as State, edge.to as State, edge.curve).x"
          :y="edgeLabelPos(edge.from as State, edge.to as State, edge.curve).y"
          text-anchor="middle"
          fill="var(--viz-text)"
          font-size="9"
          font-family="var(--vp-font-family-mono)"
          font-weight="600"
        >{{ edge.event }}</text>
      </g>

      <!-- State nodes -->
      <g v-for="(pos, state) in statePositions" :key="state" :transform="`translate(${pos.x}, ${pos.y})`">
        <circle
          r="30"
          :fill="currentState === state ? stateColors[state as State] : 'var(--vp-c-bg)'"
          :stroke="stateColors[state as State]"
          stroke-width="2.5"
          :class="{ 'sm-node-active': currentState === state }"
        />
        <text
          text-anchor="middle"
          dominant-baseline="central"
          :fill="currentState === state ? '#fff' : 'var(--viz-text)'"
          font-size="11"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >{{ (state as string).toUpperCase() }}</text>
      </g>
    </svg>

    <!-- Event history -->
    <div v-if="history.length > 0" class="sm-history">
      <span class="viz-label">{{ t('Log:', '日志：') }}&nbsp;</span>
      <span
        v-for="(h, i) in history.slice(-6)"
        :key="i"
        class="sm-history-item"
      >{{ h.event }}</span>
    </div>

    <div class="viz-controls">
      <button
        v-for="event in allEvents"
        :key="event"
        class="viz-btn"
        :class="{
          'viz-btn--primary': availableEvents.includes(event),
        }"
        :disabled="!availableEvents.includes(event)"
        @click="triggerEvent(event)"
      >{{ event }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetHappyPath">{{ t('Happy Path', '正常路径') }}</button>
      <button class="viz-btn" @click="presetErrorRecovery">{{ t('Error Recovery', '错误恢复') }}</button>
      <button class="viz-btn" @click="presetImpossibleStates">{{ t('Impossible States', '不可能状态') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.sm-svg {
  width: 100%;
  max-width: 400px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 200px;
}

.sm-node-active {
  animation: viz-pulse 0.5s ease;
}

.sm-history {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 0.5rem 0;
}

.sm-history-item {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  background: var(--viz-bg);
  color: var(--viz-text);
  border: 1px solid var(--viz-border);
}
</style>
