<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

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
}

let nextMsgId = 1;

const MESSAGE_TYPES = [
  'increment',
  'greet',
  'ping',
  'reset',
  'status',
];

const actors = ref<Actor[]>([
  { name: 'Actor A', color: 'var(--viz-primary)', mailbox: [], state: 'idle', processing: false },
  { name: 'Actor B', color: 'var(--viz-success)', mailbox: [], state: 'idle', processing: false },
  { name: 'Actor C', color: 'var(--viz-warning)', mailbox: [], state: 'idle', processing: false },
]);

const totalSent = ref(0);
const totalProcessed = ref(0);
const message = ref('Actors communicate only through messages in their mailboxes');
const timers = new Set<ReturnType<typeof setTimeout>>();

function sendMessage() {
  const fromIdx = Math.floor(Math.random() * actors.value.length);
  let toIdx = Math.floor(Math.random() * actors.value.length);
  while (toIdx === fromIdx) {
    toIdx = Math.floor(Math.random() * actors.value.length);
  }
  const sender = actors.value[fromIdx];
  const receiver = actors.value[toIdx];
  const content = MESSAGE_TYPES[Math.floor(Math.random() * MESSAGE_TYPES.length)];

  const msg: Message = {
    id: nextMsgId++,
    from: sender.name,
    to: receiver.name,
    content,
    state: 'queued',
  };

  receiver.mailbox = [...receiver.mailbox, msg];
  totalSent.value++;
  message.value = `${sender.name} sent "${content}" to ${receiver.name}`;

  if (!receiver.processing) {
    processNext(toIdx);
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
  actor.state = `processing: ${pending.content}`;
  pending.state = 'processing';

  const timer = setTimeout(() => {
    timers.delete(timer);
    pending.state = 'done';
    totalProcessed.value++;
    message.value = `${actor.name} processed "${pending.content}" from ${pending.from}`;

    // Remove done messages after a brief moment
    const cleanup = setTimeout(() => {
      timers.delete(cleanup);
      actor.mailbox = actor.mailbox.filter(m => m.id !== pending.id);
      processNext(actorIdx);
    }, 400);
    timers.add(cleanup);
  }, 800);
  timers.add(timer);
}

function reset() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  nextMsgId = 1;
  actors.value = [
    { name: 'Actor A', color: 'var(--viz-primary)', mailbox: [], state: 'idle', processing: false },
    { name: 'Actor B', color: 'var(--viz-success)', mailbox: [], state: 'idle', processing: false },
    { name: 'Actor C', color: 'var(--viz-warning)', mailbox: [], state: 'idle', processing: false },
  ];
  totalSent.value = 0;
  totalProcessed.value = 0;
  message.value = 'Reset — actors ready';
}

onUnmounted(() => {
  for (const t of timers) clearTimeout(t);
  timers.clear();
});
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive Actor Model</div>

    <!-- Stats -->
    <div class="am-stats">
      <div class="am-stat">
        <span class="am-stat-value">{{ totalSent }}</span>
        <span class="viz-label">Sent</span>
      </div>
      <div class="am-stat">
        <span class="am-stat-value am-stat--success">{{ totalProcessed }}</span>
        <span class="viz-label">Processed</span>
      </div>
      <div class="am-stat">
        <span class="am-stat-value am-stat--warning">{{ totalSent - totalProcessed }}</span>
        <span class="viz-label">Pending</span>
      </div>
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
        </div>

        <div class="am-actor-state">
          <span class="am-state-label">State:</span>
          <span class="am-state-value" :class="{ 'am-state--processing': actor.processing }">
            {{ actor.state }}
          </span>
        </div>

        <!-- Mailbox -->
        <div class="am-mailbox">
          <div class="am-mailbox-label">Mailbox</div>
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
              <span class="am-msg-from">{{ msg.from }}</span>
            </div>
            <div v-if="actor.mailbox.length === 0" class="am-mailbox-empty">empty</div>
          </div>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="sendMessage">Send Message</button>
      <button class="viz-btn viz-btn--danger" @click="reset">Reset</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.am-stats {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
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

.am-actors {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
  margin: 1rem 0;
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
  min-height: 36px;
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
  animation: am-pulse 0.8s ease-in-out infinite;
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
  padding: 0.5rem;
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
}
</style>
