<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeTimeout, clearAll, delay, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface Message {
  id: number;
  from: string;
  to: string;
  content: string;
  state: 'queued' | 'processing' | 'done';
}

interface Actor {
  name: string;
  color: string;
  mailbox: Message[];
  state: string;
  processing: boolean;
  counter: number;
  log: string[];
}

let nextMsgId = 1;

const ACTOR_NAMES = ['Actor A', 'Actor B', 'Actor C'];

const actors = ref<Actor[]>([
  {
    name: 'Actor A',
    color: 'var(--viz-primary)',
    mailbox: [],
    state: 'idle',
    processing: false,
    counter: 0,
    log: [],
  },
  {
    name: 'Actor B',
    color: 'var(--viz-success)',
    mailbox: [],
    state: 'idle',
    processing: false,
    counter: 0,
    log: [],
  },
  {
    name: 'Actor C',
    color: 'var(--viz-warning)',
    mailbox: [],
    state: 'idle',
    processing: false,
    counter: 0,
    log: [],
  },
]);

const selectedFrom = ref(0);
const selectedTo = ref(1);
const selectedMsg = ref('increment');
const customMsg = ref('');

const totalSent = ref(0);
const totalProcessed = ref(0);
const message = ref(
  t(
    'Send messages between actors — each processes its mailbox sequentially, one at a time',
    '在 Actor 之间发送消息 — 每个 Actor 按顺序逐个处理邮箱中的消息',
  ),
);
let presetRunning = false;

interface ActorSnapshot {
  actors: Actor[];
  totalSent: number;
  totalProcessed: number;
}

const history = useVizHistory<ActorSnapshot>(
  { actors: actors.value, totalSent: 0, totalProcessed: 0 },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      clearAll();
      actors.value = snap.actors;
      totalSent.value = snap.totalSent;
      totalProcessed.value = snap.totalProcessed;
      if (msg !== undefined) message.value = msg;
    },
  },
);

const msgTypes = [
  { value: 'increment', label: 'increment (+1)', labelZh: 'increment（+1）' },
  { value: 'decrement', label: 'decrement (-1)', labelZh: 'decrement（-1）' },
  { value: 'reset', label: 'reset (→ 0)', labelZh: 'reset（→ 0）' },
  { value: 'double', label: 'double (×2)', labelZh: 'double（×2）' },
  { value: 'custom', label: 'custom text…', labelZh: '自定义文本…' },
];

const toOptions = computed(() =>
  ACTOR_NAMES.map((n, i) => ({ value: i, label: n })).filter((_, i) => i !== selectedFrom.value),
);

function fixTo() {
  if (selectedTo.value === selectedFrom.value) {
    selectedTo.value = toOptions.value[0]?.value ?? 0;
  }
}

function sendMessage() {
  fixTo();
  const sender = actors.value[selectedFrom.value];
  const receiver = actors.value[selectedTo.value];
  const content =
    selectedMsg.value === 'custom' ? customMsg.value.trim() || 'hello' : selectedMsg.value;

  const msg: Message = {
    id: nextMsgId++,
    from: sender.name,
    to: receiver.name,
    content,
    state: 'queued',
  };

  receiver.mailbox = [...receiver.mailbox, msg];
  totalSent.value++;
  message.value = t(
    `${sender.name} → ${receiver.name}: "${content}". Messages are enqueued — the actor processes them one at a time, ensuring no shared mutable state.`,
    `${sender.name} → ${receiver.name}："${content}"。消息被排入队列 — Actor 逐个处理，确保没有共享可变状态。`,
  );
  log(message.value, 'info');
  history.commit(
    { actors: actors.value, totalSent: totalSent.value, totalProcessed: totalProcessed.value },
    `send: ${content}`,
  );

  if (!receiver.processing) {
    processNext(selectedTo.value);
  }
}

function flood() {
  const target = selectedTo.value;
  const sender = actors.value[selectedFrom.value];
  const receiver = actors.value[target];
  const msgs: Message[] = [];

  for (let i = 0; i < 5; i++) {
    const msg: Message = {
      id: nextMsgId++,
      from: sender.name,
      to: receiver.name,
      content: 'increment',
      state: 'queued',
    };
    msgs.push(msg);
  }

  receiver.mailbox = [...receiver.mailbox, ...msgs];
  totalSent.value += 5;
  message.value = t(
    `Flooded ${receiver.name} with 5 messages — mailbox acts as a backpressure buffer. Erlang/OTP processes handle millions of queued messages this way.`,
    `向 ${receiver.name} 洪泛 5 条消息 — 邮箱充当背压缓冲区。Erlang/OTP 进程以这种方式处理数百万排队消息。`,
  );
  log(message.value, 'warning');
  history.commit(
    { actors: actors.value, totalSent: totalSent.value, totalProcessed: totalProcessed.value },
    'flood x5',
  );

  if (!receiver.processing) {
    processNext(target);
  }
}

function processNext(actorIdx: number) {
  const actor = actors.value[actorIdx];
  const pending = actor.mailbox.find((m) => m.state === 'queued');
  if (!pending) {
    actor.processing = false;
    actor.state = 'idle';
    history.commit(
      { actors: actors.value, totalSent: totalSent.value, totalProcessed: totalProcessed.value },
      `idle: ${actor.name}`,
    );
    return;
  }

  actor.processing = true;
  actor.state = `→ ${pending.content}`;
  pending.state = 'processing';

  safeTimeout(() => {
    pending.state = 'done';
    totalProcessed.value++;

    switch (pending.content) {
      case 'increment':
        actor.counter++;
        break;
      case 'decrement':
        actor.counter--;
        break;
      case 'reset':
        actor.counter = 0;
        break;
      case 'double':
        actor.counter *= 2;
        break;
      default:
        break;
    }
    actor.log = [...actor.log.slice(-4), `${pending.content} (from ${pending.from})`];
    history.commit(
      { actors: actors.value, totalSent: totalSent.value, totalProcessed: totalProcessed.value },
      `process: ${pending.content}`,
    );

    safeTimeout(() => {
      actor.mailbox = actor.mailbox.filter((m) => m.id !== pending.id);
      processNext(actorIdx);
    }, 300);
  }, 600);
}

function reset() {
  clearAll();
  nextMsgId = 1;
  actors.value = [
    {
      name: 'Actor A',
      color: 'var(--viz-primary)',
      mailbox: [],
      state: 'idle',
      processing: false,
      counter: 0,
      log: [],
    },
    {
      name: 'Actor B',
      color: 'var(--viz-success)',
      mailbox: [],
      state: 'idle',
      processing: false,
      counter: 0,
      log: [],
    },
    {
      name: 'Actor C',
      color: 'var(--viz-warning)',
      mailbox: [],
      state: 'idle',
      processing: false,
      counter: 0,
      log: [],
    },
  ];
  totalSent.value = 0;
  totalProcessed.value = 0;
  presetRunning = false;
  message.value = t('Reset — actors ready', '已重置 — Actor 就绪');
  clearLog();
  history.reset();
}

async function presetPingPong() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  clearLog();
  message.value = t(
    'Ping-pong: A sends to B, B sends to C, C sends back to A. This circular message flow is how Erlang supervision trees propagate health checks.',
    'Ping-pong：A 发送给 B，B 发送给 C，C 发回给 A。这种循环消息流就是 Erlang 监督树传播健康检查的方式。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  // A -> B
  selectedFrom.value = 0;
  selectedTo.value = 1;
  selectedMsg.value = 'increment';
  sendMessage();
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  // B -> C
  selectedFrom.value = 1;
  selectedTo.value = 2;
  selectedMsg.value = 'increment';
  sendMessage();
  await delay(1000);
  if (!presetRunning || isAborted()) return;

  // C -> A
  selectedFrom.value = 2;
  selectedTo.value = 0;
  selectedMsg.value = 'increment';
  sendMessage();
  await delay(1200);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'All 3 actors processed one message each — no locks needed! Each actor is single-threaded internally. Akka (JVM) and Orleans (.NET) use this exact pattern for distributed systems.',
    '所有 3 个 Actor 各处理了一条消息 — 不需要锁！每个 Actor 内部是单线程的。Akka (JVM) 和 Orleans (.NET) 在分布式系统中使用完全相同的模式。',
  );
  log(message.value, 'success');
  log(
    t(
      'Actor model eliminates shared state — each actor processes messages sequentially without locks.',
      'Actor 模型消除共享状态 — 每个 Actor 按顺序处理消息，无需锁。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetMailboxOverflow() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  clearLog();
  message.value = t(
    'Flooding Actor B — watch the mailbox queue grow. In production, mailbox overflow causes backpressure. Erlang kills processes with oversized mailboxes by default.',
    '洪泛 Actor B — 观察邮箱队列增长。生产环境中，邮箱溢出导致背压。Erlang 默认会杀死邮箱过大的进程。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  selectedFrom.value = 0;
  selectedTo.value = 1;
  flood();
  await delay(600);
  if (!presetRunning || isAborted()) return;

  selectedFrom.value = 2;
  flood();
  await delay(1500);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    '10 messages queued in B\'s mailbox — processed FIFO. Without backpressure, this is how "hot actor" problems cause memory exhaustion in distributed systems.',
    '10 条消息排入 B 的邮箱 — FIFO 处理。没有背压时，这就是"热 Actor"问题在分布式系统中导致内存耗尽的方式。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetFanOut() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  clearLog();
  message.value = t(
    'Fan-out: A broadcasts to B and C simultaneously. This is the pub/sub pattern — used in event-driven architectures like NATS and Kafka consumer groups.',
    'Fan-out：A 同时广播给 B 和 C。这是发布/订阅模式 — 用于 NATS 和 Kafka 消费者组等事件驱动架构。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  selectedFrom.value = 0;
  selectedMsg.value = 'increment';
  selectedTo.value = 1;
  sendMessage();
  await delay(200);
  if (!presetRunning || isAborted()) return;
  selectedTo.value = 2;
  sendMessage();
  await delay(1200);
  if (!presetRunning || isAborted()) return;

  selectedMsg.value = 'double';
  selectedTo.value = 1;
  sendMessage();
  await delay(200);
  if (!presetRunning || isAborted()) return;
  selectedTo.value = 2;
  sendMessage();
  await delay(1500);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    "Fan-out complete — B and C received identical messages but process independently. Location transparency: the sender doesn't care if recipients are local or remote.",
    'Fan-out 完成 — B 和 C 收到相同消息但独立处理。位置透明性：发送者不关心接收者是本地还是远程。',
  );
  log(message.value, 'success');
  log(
    t(
      'Fan-out decouples sender from receivers — location transparency enables distributed scaling.',
      'Fan-out 将发送者与接收者解耦 — 位置透明性支持分布式扩展。',
    ),
    'highlight',
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Actor Model', '交互式 Actor 模型') }}</div>

    <!-- Stats -->
    <div class="am-stats">
      <div class="am-stat">
        <span class="am-stat-value">{{ totalSent }}</span>
        <span class="viz-label">{{ t('Sent', '已发送') }}</span>
      </div>
      <div class="am-stat">
        <span class="am-stat-value am-stat--success">{{ totalProcessed }}</span>
        <span class="viz-label">{{ t('Processed', '已处理') }}</span>
      </div>
      <div class="am-stat">
        <span class="am-stat-value am-stat--warning">{{ totalSent - totalProcessed }}</span>
        <span class="viz-label">{{ t('Pending', '待处理') }}</span>
      </div>
    </div>

    <!-- Send controls -->
    <div class="am-send-row">
      <div class="am-send-group">
        <label class="am-send-label">{{ t('From', '发送方') }}</label>
        <select v-model.number="selectedFrom" class="am-select" @change="fixTo">
          <option v-for="(name, i) in ACTOR_NAMES" :key="i" :value="i">{{ name }}</option>
        </select>
      </div>
      <div class="am-send-arrow">→</div>
      <div class="am-send-group">
        <label class="am-send-label">{{ t('To', '接收方') }}</label>
        <select v-model.number="selectedTo" class="am-select">
          <option v-for="opt in toOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="am-send-group am-send-group--msg">
        <label class="am-send-label">{{ t('Message', '消息') }}</label>
        <select v-model="selectedMsg" class="am-select">
          <option v-for="mt in msgTypes" :key="mt.value" :value="mt.value">
            {{ t(mt.label, mt.labelZh) }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="selectedMsg === 'custom'" class="am-custom-row">
      <input
        v-model="customMsg"
        class="am-input"
        :placeholder="t('Type a message…', '输入消息…')"
        maxlength="20"
        @keyup.enter="sendMessage"
      />
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="sendMessage">{{ t('Send', '发送') }}</button>
      <button class="viz-btn viz-btn--warning" @click="flood">
        {{ t('Flood ×5', '洪泛 ×5') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetPingPong">{{ t('Ping-Pong', 'Ping-Pong') }}</button>
      <button class="viz-btn" @click="presetMailboxOverflow">
        {{ t('Mailbox Flood', '邮箱洪泛') }}
      </button>
      <button class="viz-btn" @click="presetFanOut">{{ t('Fan-Out', 'Fan-Out') }}</button>
    </div>

    <!-- Actors -->
    <div class="am-actors">
      <div
        v-for="actor in actors"
        :key="actor.name"
        class="am-actor"
        :class="{ 'am-actor--active': actor.processing }"
      >
        <div class="am-actor-header">
          <div class="am-actor-dot" :style="{ background: actor.color }"></div>
          <span class="am-actor-name">{{ actor.name }}</span>
          <span class="am-actor-counter" :style="{ color: actor.color }">{{ actor.counter }}</span>
        </div>

        <div class="am-actor-state">
          <span class="am-state-label">{{ t('State', '状态') }}:</span>
          <span class="am-state-value" :class="{ 'am-state--processing': actor.processing }">
            {{ actor.state }}
          </span>
        </div>

        <!-- Mailbox -->
        <div class="am-mailbox">
          <div class="am-mailbox-label">
            {{ t('Mailbox', '邮箱') }} ({{ actor.mailbox.length }})
          </div>
          <div class="am-mailbox-items">
            <div
              v-for="msg in actor.mailbox"
              :key="msg.id"
              class="am-msg"
              :class="{
                'am-msg--queued': msg.state === 'queued',
                'am-msg--processing': msg.state === 'processing',
                'am-msg--done': msg.state === 'done',
              }"
            >
              <span class="am-msg-content">{{ msg.content }}</span>
              <span class="am-msg-from">← {{ msg.from }}</span>
            </div>
            <div v-if="actor.mailbox.length === 0" class="am-mailbox-empty">
              {{ t('empty', '空') }}
            </div>
          </div>
        </div>

        <!-- Log -->
        <div v-if="actor.log.length > 0" class="am-log">
          <div class="am-log-label">{{ t('History', '历史') }}</div>
          <div v-for="(entry, i) in actor.log" :key="i" class="am-log-entry">{{ entry }}</div>
        </div>
      </div>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.am-stats {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.am-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 56px;
}

.am-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.am-stat--success {
  color: var(--viz-success);
}

.am-stat--warning {
  color: var(--viz-warning);
}

/* Send controls */
.am-send-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.am-send-group {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.am-send-group--msg {
  flex: 1;
  min-width: 140px;
}

.am-send-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
}

.am-send-arrow {
  font-size: 1rem;
  font-weight: 700;
  color: var(--viz-muted);
  padding-bottom: 0.25rem;
}

.am-select {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  cursor: pointer;
}

.am-select:focus {
  outline: none;
  border-color: var(--viz-primary);
}

.am-custom-row {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.am-input {
  width: 240px;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.am-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

/* Actors */
.am-actors {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
  margin: 0.75rem 0;
}

.am-actor {
  flex: 1;
  min-width: 150px;
  max-width: 220px;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  padding: 0.625rem;
  background: var(--vp-c-bg);
  transition:
    border-color var(--viz-transition),
    box-shadow 0.3s ease;
}

.am-actor--active {
  border-color: var(--viz-primary);
  box-shadow: 0 0 0 2px rgb(59 130 246 / 15%);
}

.am-actor-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
}

.am-actor-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.am-actor-name {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  flex: 1;
}

.am-actor-counter {
  font-size: 1.25rem;
  font-weight: 800;
  font-family: var(--vp-font-family-mono);
}

.am-actor-state {
  font-size: 0.6875rem;
  margin-bottom: 0.375rem;
  display: flex;
  gap: 0.25rem;
  align-items: baseline;
}

.am-state-label {
  color: var(--viz-muted);
  font-weight: 600;
}

.am-state-value {
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
  font-size: 0.625rem;
}

.am-state--processing {
  color: var(--viz-primary);
  font-weight: 700;
}

.am-mailbox {
  border-top: 1px solid var(--viz-border);
  padding-top: 0.375rem;
}

.am-mailbox-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-bottom: 0.25rem;
}

.am-mailbox-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 28px;
}

.am-msg {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.625rem;
  font-family: var(--vp-font-family-mono);
  animation: viz-slide-in 0.3s ease;
}

.am-msg--queued {
  background: rgb(59 130 246 / 8%);
  border: 1px solid transparent;
}

.am-msg--processing {
  background: rgb(59 130 246 / 15%);
  border: 1px solid var(--viz-primary);
  animation: viz-pulse 0.6s ease-in-out infinite;
}

.am-msg--done {
  background: rgb(16 185 129 / 10%);
  border: 1px solid var(--viz-success);
  opacity: 0.6;
}

.am-msg-content {
  font-weight: 600;
  color: var(--viz-text);
}

.am-msg-from {
  color: var(--viz-muted);
  font-size: 0.5625rem;
}

.am-mailbox-empty {
  font-size: 0.625rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
  padding: 0.375rem;
}

.am-log {
  border-top: 1px solid var(--viz-border);
  padding-top: 0.25rem;
  margin-top: 0.25rem;
}

.am-log-label {
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-bottom: 0.125rem;
}

.am-log-entry {
  font-size: 0.5625rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  padding: 1px 0;
}

@media (width <= 640px) {
  .am-actors {
    flex-direction: column;
    align-items: stretch;
  }

  .am-actor {
    max-width: none;
  }

  .am-send-row {
    flex-direction: column;
    align-items: stretch;
  }

  .am-send-arrow {
    text-align: center;
  }
}
</style>
