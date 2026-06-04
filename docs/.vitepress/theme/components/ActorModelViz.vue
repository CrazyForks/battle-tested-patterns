<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

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
  { name: 'Actor A', color: 'var(--viz-primary)', mailbox: [], state: 'idle', processing: false, counter: 0, log: [] },
  { name: 'Actor B', color: 'var(--viz-success)', mailbox: [], state: 'idle', processing: false, counter: 0, log: [] },
  { name: 'Actor C', color: 'var(--viz-warning)', mailbox: [], state: 'idle', processing: false, counter: 0, log: [] },
]);

const selectedFrom = ref(0);
const selectedTo = ref(1);
const selectedMsg = ref('increment');
const customMsg = ref('');

const totalSent = ref(0);
const totalProcessed = ref(0);
const message = ref('');
const timers = new Set<ReturnType<typeof setTimeout>>();

const msgTypes = [
  { value: 'increment', label: 'increment (+1)', labelZh: 'increment（+1）' },
  { value: 'decrement', label: 'decrement (-1)', labelZh: 'decrement（-1）' },
  { value: 'reset', label: 'reset (→ 0)', labelZh: 'reset（→ 0）' },
  { value: 'double', label: 'double (×2)', labelZh: 'double（×2）' },
  { value: 'custom', label: 'custom text…', labelZh: '自定义文本…' },
];

const toOptions = computed(() =>
  ACTOR_NAMES.map((n, i) => ({ value: i, label: n })).filter((_, i) => i !== selectedFrom.value)
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
  const content = selectedMsg.value === 'custom' ? (customMsg.value.trim() || 'hello') : selectedMsg.value;

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
    `${sender.name} → ${receiver.name}: "${content}"`,
    `${sender.name} → ${receiver.name}："${content}"`
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
    `Flooded ${receiver.name} with 5 messages — watch the mailbox queue!`,
    `向 ${receiver.name} 洪泛 5 条消息 — 观察邮箱排队！`
  );

  if (!receiver.processing) {
    processNext(target);
  }
}

function processNext(actorIdx: number) {
  const actor = actors.value[actorIdx];
  const pending = actor.mailbox.find(m => m.state === 'queued');
  if (!pending) {
    actor.processing = false;
    actor.state = 'idle';
    return;
  }

  actor.processing = true;
  actor.state = `→ ${pending.content}`;
  pending.state = 'processing';

  const timer = setTimeout(() => {
    timers.delete(timer);
    pending.state = 'done';
    totalProcessed.value++;

    // Apply state change based on message
    switch (pending.content) {
      case 'increment': actor.counter++; break;
      case 'decrement': actor.counter--; break;
      case 'reset':     actor.counter = 0; break;
      case 'double':    actor.counter *= 2; break;
      default: break; // custom messages don't change counter
    }
    actor.log = [...actor.log.slice(-4), `${pending.content} (from ${pending.from})`];

    const cleanup = setTimeout(() => {
      timers.delete(cleanup);
      actor.mailbox = actor.mailbox.filter(m => m.id !== pending.id);
      processNext(actorIdx);
    }, 300);
    timers.add(cleanup);
  }, 600);
  timers.add(timer);
}

function reset() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  nextMsgId = 1;
  actors.value = [
    { name: 'Actor A', color: 'var(--viz-primary)', mailbox: [], state: 'idle', processing: false, counter: 0, log: [] },
    { name: 'Actor B', color: 'var(--viz-success)', mailbox: [], state: 'idle', processing: false, counter: 0, log: [] },
    { name: 'Actor C', color: 'var(--viz-warning)', mailbox: [], state: 'idle', processing: false, counter: 0, log: [] },
  ];
  totalSent.value = 0;
  totalProcessed.value = 0;
  message.value = t('Reset — actors ready', '已重置 — Actor 就绪');
}

onUnmounted(() => {
  for (const t of timers) clearTimeout(t);
  timers.clear();
});
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
          <option v-for="opt in toOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="am-send-group am-send-group--msg">
        <label class="am-send-label">{{ t('Message', '消息') }}</label>
        <select v-model="selectedMsg" class="am-select">
          <option v-for="mt in msgTypes" :key="mt.value" :value="mt.value">{{ t(mt.label, mt.labelZh) }}</option>
        </select>
      </div>
    </div>

    <div v-if="selectedMsg === 'custom'" class="am-custom-row">
      <input v-model="customMsg" class="am-input" :placeholder="t('Type a message…', '输入消息…')" maxlength="20" @keyup.enter="sendMessage" />
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="sendMessage">{{ t('Send', '发送') }}</button>
      <button class="viz-btn viz-btn--warning" @click="flood">{{ t('Flood ×5', '洪泛 ×5') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
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
          <div class="am-mailbox-label">{{ t('Mailbox', '邮箱') }} ({{ actor.mailbox.length }})</div>
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
            <div v-if="actor.mailbox.length === 0" class="am-mailbox-empty">{{ t('empty', '空') }}</div>
          </div>
        </div>

        <!-- Log -->
        <div v-if="actor.log.length > 0" class="am-log">
          <div class="am-log-label">{{ t('History', '历史') }}</div>
          <div v-for="(entry, i) in actor.log" :key="i" class="am-log-entry">{{ entry }}</div>
        </div>
      </div>
    </div>

    <div class="viz-status">{{ message || t(
      'Choose sender, receiver, and message type — then click Send',
      '选择发送方、接收方和消息类型 — 然后点击发送'
    ) }}</div>
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

.am-stat--success { color: var(--viz-success); }
.am-stat--warning { color: var(--viz-warning); }

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
  border-radius: 6px;
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
  border-radius: 6px;
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
  border-radius: 8px;
  padding: 0.625rem;
  background: var(--vp-c-bg);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.am-actor--active {
  border-color: var(--viz-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
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
  border-radius: 4px;
  font-size: 0.625rem;
  font-family: var(--vp-font-family-mono);
  animation: am-arrive 0.3s ease;
}

.am-msg--queued {
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid transparent;
}

.am-msg--processing {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid var(--viz-primary);
  animation: am-pulse 0.6s ease-in-out infinite;
}

.am-msg--done {
  background: rgba(16, 185, 129, 0.1);
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

.viz-btn--warning {
  border-color: var(--viz-warning);
  color: var(--viz-warning);
}

.viz-btn--warning:hover {
  background: var(--viz-warning);
  color: #fff;
}

@keyframes am-arrive {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes am-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (max-width: 640px) {
  .am-actors { flex-direction: column; align-items: stretch; }
  .am-actor { max-width: none; }
  .am-send-row { flex-direction: column; align-items: stretch; }
  .am-send-arrow { text-align: center; }
}
</style>
