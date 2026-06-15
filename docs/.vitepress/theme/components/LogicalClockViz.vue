<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface Process {
  name: string;
  color: string;
  clock: number;
  events: { type: 'local' | 'send' | 'recv'; clock: number; label: string }[];
}

const processes = ref<Process[]>([
  { name: 'P1', color: 'var(--viz-primary)', clock: 0, events: [] },
  { name: 'P2', color: 'var(--viz-success)', clock: 0, events: [] },
  { name: 'P3', color: 'var(--viz-warning)', clock: 0, events: [] },
]);

const message = ref(
  t(
    'Perform local events and send messages between processes — Lamport clocks establish causal ordering in distributed systems like DynamoDB and Cassandra',
    '执行本地事件并在进程间发送消息 — Lamport 时钟在 DynamoDB 和 Cassandra 等分布式系统中建立因果顺序',
  ),
);
const pendingMessages = ref<{ from: number; clock: number }[]>([]);
let presetRunning = false;

interface Snapshot {
  processes: Process[];
  pendingMessages: { from: number; clock: number }[];
}

const vizHistory = useVizHistory<Snapshot>(
  {
    processes: [
      { name: 'P1', color: 'var(--viz-primary)', clock: 0, events: [] },
      { name: 'P2', color: 'var(--viz-success)', clock: 0, events: [] },
      { name: 'P3', color: 'var(--viz-warning)', clock: 0, events: [] },
    ],
    pendingMessages: [],
  },
  {
    getMessage: () => message.value,
    onRestore(s, msg) {
      presetRunning = false;
      processes.value = s.processes;
      pendingMessages.value = s.pendingMessages;
      if (msg !== undefined) message.value = msg;
    },
  },
);

function localEvent(idx: number) {
  const p = processes.value[idx];
  p.clock++;
  p.events = [...p.events, { type: 'local', clock: p.clock, label: 'local' }];
  message.value = t(
    `${p.name}: local event → clock = ${p.clock}. Rule: increment on every event. This timestamps the event for causal ordering.`,
    `${p.name}：本地事件 → 时钟 = ${p.clock}。规则：每个事件递增。这为因果排序标记时间戳。`,
  );
  vizHistory.commit(
    { processes: processes.value, pendingMessages: pendingMessages.value },
    `${p.name} local event`,
  );
}

function sendMessage(fromIdx: number) {
  const from = processes.value[fromIdx];
  from.clock++;
  from.events = [...from.events, { type: 'send', clock: from.clock, label: 'send' }];
  pendingMessages.value = [...pendingMessages.value, { from: fromIdx, clock: from.clock }];
  message.value = t(
    `${from.name}: sent message (clock=${from.clock}) — click "Receive" on another process. The message carries the sender's timestamp.`,
    `${from.name}：已发送消息 (clock=${from.clock}) — 在其他进程上点击"接收"。消息携带发送方的时间戳。`,
  );
  vizHistory.commit(
    { processes: processes.value, pendingMessages: pendingMessages.value },
    `${from.name} send`,
  );
}

function receiveMessage(toIdx: number) {
  if (pendingMessages.value.length === 0) {
    message.value = t('No pending messages — send one first', '没有待处理消息 — 请先发送一条');
    return;
  }
  const msg = pendingMessages.value[0];
  if (msg.from === toIdx) {
    message.value = t(
      'Cannot receive your own message — pick a different process',
      '不能接收自己的消息 — 请选择其他进程',
    );
    return;
  }
  pendingMessages.value = pendingMessages.value.slice(1);

  const to = processes.value[toIdx];
  const prevClock = to.clock;
  to.clock = Math.max(to.clock, msg.clock) + 1;
  to.events = [...to.events, { type: 'recv', clock: to.clock, label: `recv(${msg.clock})` }];
  message.value = t(
    `${to.name}: received (sender clock=${msg.clock}) → max(${prevClock}, ${msg.clock}) + 1 = ${to.clock}. The max() ensures causal ordering: if A→B, then clock(A) < clock(B).`,
    `${to.name}：已接收 (发送方 clock=${msg.clock}) → max(${prevClock}, ${msg.clock}) + 1 = ${to.clock}。max() 确保因果顺序：如果 A→B，则 clock(A) < clock(B)。`,
  );
  log(message.value, 'success');
  vizHistory.commit(
    { processes: processes.value, pendingMessages: pendingMessages.value },
    `${to.name} receive`,
  );
}

function reset() {
  clearAll();
  processes.value = [
    { name: 'P1', color: 'var(--viz-primary)', clock: 0, events: [] },
    { name: 'P2', color: 'var(--viz-success)', clock: 0, events: [] },
    { name: 'P3', color: 'var(--viz-warning)', clock: 0, events: [] },
  ];
  pendingMessages.value = [];
  presetRunning = false;
  message.value = t(
    'Reset — perform events to see Lamport clocks',
    '已重置 — 执行事件以查看 Lamport 时钟',
  );
  clearLog();
  vizHistory.reset();
}

async function presetCausalChain() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Causal chain: P1 does work, sends to P2, P2 does work, sends to P3. Each receive merges clocks — this is how "happens-before" ordering works in distributed databases.',
    '因果链：P1 工作，发送给 P2，P2 工作，发送给 P3。每次接收合并时钟 — 这就是分布式数据库中"先于"排序的工作方式。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  localEvent(0);
  await delay(400);
  if (!presetRunning || isAborted()) return;
  sendMessage(0);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  receiveMessage(1);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  localEvent(1);
  await delay(400);
  if (!presetRunning || isAborted()) return;
  sendMessage(1);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  receiveMessage(2);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    "Causal chain complete: P1 send(2)→P2 recv(3)→P2 send(5)→P3 recv(6). Each receive's clock is strictly greater than the send — this guarantees if A caused B, clock(A) < clock(B). Used by Spanner, CockroachDB, and TiDB.",
    '因果链完成：P1 send(2)→P2 recv(3)→P2 send(5)→P3 recv(6)。每次接收的时钟严格大于发送 — 保证如果 A 导致了 B，则 clock(A) < clock(B)。Spanner、CockroachDB 和 TiDB 使用此原理。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetConcurrentEvents() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Concurrent events: P1, P2, P3 all do local events independently. Their clocks advance separately — these events are concurrent (no causal relationship). Lamport clocks cannot distinguish concurrent events from causally related ones.',
    '并发事件：P1、P2、P3 各自独立做本地事件。它们的时钟分别推进 — 这些事件是并发的（无因果关系）。Lamport 时钟无法区分并发事件和因果相关事件。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  localEvent(0);
  log(t('P1 local event', 'P1 本地事件'), 'info');
  await delay(300);
  if (!presetRunning || isAborted()) return;
  localEvent(1);
  log(t('P2 local event', 'P2 本地事件'), 'info');
  await delay(300);
  if (!presetRunning || isAborted()) return;
  localEvent(2);
  log(t('P3 local event', 'P3 本地事件'), 'info');
  await delay(300);
  if (!presetRunning || isAborted()) return;
  localEvent(0);
  log(t('P1 local event #2', 'P1 本地事件 #2'), 'info');
  await delay(300);
  if (!presetRunning || isAborted()) return;
  localEvent(2);
  log(t('P3 local event #2', 'P3 本地事件 #2'), 'info');
  await delay(500);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    "All three processes have clock=1 or clock=2 — same value but no causal link. This is Lamport clocks' limitation: equal timestamps don't mean simultaneous. Vector clocks (used by DynamoDB) solve this by tracking per-process counters.",
    '三个进程的时钟都是 1 或 2 — 相同值但无因果关系。这是 Lamport 时钟的局限：相等的时间戳不意味着同时发生。向量时钟（DynamoDB 使用）通过跟踪每个进程的计数器解决此问题。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetClockSkew() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Clock synchronization: P1 does 5 local events (clock=5), then sends to P2 (clock becomes 6 on send). P2's clock jumps to 7 — the max() rule synchronizes clocks across the system.",
    '时钟同步：P1 做 5 个本地事件（clock=5），发送时 clock 变为 6。P2 的时钟跳到 7 — max() 规则在系统间同步时钟。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 5; i++) {
    localEvent(0);
    log(t(`P1 local event #${i + 1}`, `P1 本地事件 #${i + 1}`), 'info');
    await delay(250);
    if (!presetRunning || isAborted()) return;
  }
  sendMessage(0);
  log(t('P1 send → clock incremented', 'P1 发送 → 时钟递增'), 'info');
  await delay(500);
  if (!presetRunning || isAborted()) return;
  receiveMessage(1);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    "P2 jumped from 0 to 7: max(0, 6) + 1 = 7. The send incremented P1's clock to 6, and the message carries that value. This ensures P2's future events are ordered after P1's message.",
    'P2 从 0 跳到 7：max(0, 6) + 1 = 7。发送时 P1 的时钟递增到 6，消息携带该值。这确保 P2 的未来事件排在 P1 的消息之后。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Lamport Clock', '交互式 Lamport 时钟') }}</div>

    <div class="lc-processes">
      <div
        v-for="(p, i) in processes"
        :key="p.name"
        class="lc-process"
        :style="{ borderColor: p.color }"
      >
        <div class="lc-header">
          <span class="lc-name" :style="{ color: p.color }">{{ p.name }}</span>
          <span class="lc-clock">{{ t('clock:', '时钟：') }} {{ p.clock }}</span>
        </div>

        <div class="lc-timeline">
          <span
            v-for="(ev, j) in p.events.slice(-6)"
            :key="j"
            class="lc-event"
            :class="'lc-event-' + ev.type"
          >
            <span class="lc-event-clock">{{ ev.clock }}</span>
            <span class="lc-event-label">{{ ev.label }}</span>
          </span>
        </div>

        <div class="lc-actions">
          <button class="viz-btn lc-btn" @click="localEvent(i)">{{ t('Local', '本地') }}</button>
          <button class="viz-btn lc-btn" @click="sendMessage(i)">{{ t('Send', '发送') }}</button>
          <button class="viz-btn lc-btn" @click="receiveMessage(i)">
            {{ t('Receive', '接收') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="pendingMessages.length > 0" class="lc-pending">
      {{ t('Pending messages:', '待处理消息：') }}
      {{
        pendingMessages
          .map((m) =>
            t(
              `from ${processes[m.from].name}(${m.clock})`,
              `来自 ${processes[m.from].name}(${m.clock})`,
            ),
          )
          .join(', ')
      }}
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetCausalChain">{{ t('Causal Chain', '因果链') }}</button>
      <button class="viz-btn" @click="presetConcurrentEvents">{{ t('Concurrent', '并发') }}</button>
      <button class="viz-btn" @click="presetClockSkew">{{ t('Clock Sync', '时钟同步') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.lc-processes {
  display: flex;
  gap: 8px;
  padding: 1rem 0;
}

@media (width <= 640px) {
  .lc-processes {
    flex-direction: column;
  }
}

.lc-process {
  flex: 1;
  border: 2px solid;
  border-radius: var(--viz-radius-sm);
  padding: 0.5rem;
  background: var(--vp-c-bg);
}

.lc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.lc-name {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
}

.lc-clock {
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.lc-timeline {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  min-height: 32px;
  margin-bottom: 6px;
}

.lc-event {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 5px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.6rem;
  font-family: var(--vp-font-family-mono);
  animation: viz-slide-in 0.2s ease;
}

.lc-event-local {
  background: rgb(59 130 246 / 15%);
  color: var(--viz-primary);
}

.lc-event-send {
  background: rgb(245 158 11 / 15%);
  color: var(--viz-warning);
}

.lc-event-recv {
  background: rgb(16 185 129 / 15%);
  color: var(--viz-success);
}

.lc-event-clock {
  font-weight: 700;
  font-size: 0.75rem;
}

.lc-event-label {
  font-size: 0.5rem;
}

.lc-actions {
  display: flex;
  gap: 3px;
}

.lc-btn {
  flex: 1;
  font-size: 0.6rem;
  padding: 0.2rem 0.3rem;
}

.lc-pending {
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-warning);
  text-align: center;
  padding: 0.3rem;
  background: rgb(245 158 11 / 10%);
  border-radius: var(--viz-radius-sm);
}
</style>
