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

interface Subscriber {
  id: number;
  name: string;
  messages: string[];
}

let nextId = 0;
let presetRunning = false;

const subscribers = ref<Subscriber[]>([
  { id: nextId++, name: 'Logger', messages: [] },
  { id: nextId++, name: 'UI', messages: [] },
  { id: nextId++, name: 'Analytics', messages: [] },
]);

const events = ['click', 'submit', 'error', 'login'];
const lastEvent = ref('');
const broadcasting = ref(false);
const message = ref(
  t(
    'Click "Emit Event" to broadcast to all subscribers — this is how DOM addEventListener, Node.js EventEmitter, and RxJS Subjects work',
    '点击"发送事件"向所有订阅者广播 — DOM addEventListener、Node.js EventEmitter 和 RxJS Subject 就是这样工作的',
  ),
);

interface ObserverSnapshot {
  subscribers: Subscriber[];
  lastEvent: string;
}

const history = useVizHistory<ObserverSnapshot>(
  { subscribers: subscribers.value, lastEvent: lastEvent.value },
  {
    getMessage: () => message.value,
    onRestore(state, msg) {
      presetRunning = false;
      subscribers.value = state.subscribers;
      lastEvent.value = state.lastEvent;
      broadcasting.value = false;
      if (msg !== undefined) message.value = msg;
    },
  },
);

async function emitEvent() {
  if (broadcasting.value) return;
  broadcasting.value = true;
  const event = events[Math.floor(Math.random() * events.length)];
  lastEvent.value = event;
  message.value = t(
    `Broadcasting "${event}" to ${subscribers.value.length} subscribers...`,
    `正在向 ${subscribers.value.length} 个订阅者广播 "${event}"...`,
  );

  for (const sub of subscribers.value) {
    sub.messages = [...sub.messages, event];
    if (sub.messages.length > 5) sub.messages = sub.messages.slice(-5);
    await delay(200);
    if (isAborted()) return;
  }

  message.value = t(`"${event}" delivered to all subscribers`, `"${event}" 已送达所有订阅者`);
  log(message.value, 'success');
  await delay(400);
  if (isAborted()) return;
  lastEvent.value = '';
  broadcasting.value = false;
  history.commit(
    { subscribers: subscribers.value, lastEvent: lastEvent.value },
    `broadcast "${event}"`,
  );
}

function addSubscriber() {
  const names = ['DB Writer', 'Cache', 'Notifier', 'Metrics', 'Auditor'];
  const name = names[subscribers.value.length % names.length];
  if (subscribers.value.length >= 6) {
    message.value = t('Maximum 6 subscribers', '最多 6 个订阅者');
    return;
  }
  subscribers.value.push({ id: nextId++, name, messages: [] });
  message.value = t(`${name} subscribed`, `${name} 已订阅`);
  history.commit(
    { subscribers: subscribers.value, lastEvent: lastEvent.value },
    `subscribe ${name}`,
  );
}

function removeSubscriber() {
  if (subscribers.value.length <= 1) {
    message.value = t('Need at least 1 subscriber', '至少需要 1 个订阅者');
    return;
  }
  const removed = subscribers.value.pop()!;
  message.value = t(`${removed.name} unsubscribed`, `${removed.name} 已取消订阅`);
  history.commit(
    { subscribers: subscribers.value, lastEvent: lastEvent.value },
    `unsubscribe ${removed.name}`,
  );
}

function reset() {
  clearAll();
  nextId = 0;
  presetRunning = false;
  subscribers.value = [
    { id: nextId++, name: 'Logger', messages: [] },
    { id: nextId++, name: 'UI', messages: [] },
    { id: nextId++, name: 'Analytics', messages: [] },
  ];
  lastEvent.value = '';
  broadcasting.value = false;
  message.value = t('Observer reset', 'Observer 已重置');
  clearLog();
  history.reset();
}

async function presetFanOut() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  addSubscriber();
  addSubscriber();
  message.value = t(
    'Fan-out: 5 subscribers receive every event. This is the pub/sub pattern — one publisher, many consumers. Used by Kafka topics, Redis pub/sub, and AWS SNS.',
    'Fan-out：5 个订阅者接收每个事件。这是发布/订阅模式 — 一个发布者，多个消费者。Kafka topics、Redis pub/sub 和 AWS SNS 都使用此模式。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  await emitEvent();
  await delay(400);
  if (!presetRunning || isAborted()) return;
  await emitEvent();
  await delay(400);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'All 5 subscribers received both events. The publisher does not know or care who is listening — this decoupling is the key benefit. Adding a 6th subscriber requires zero changes to the publisher.',
    '全部 5 个订阅者接收了两个事件。发布者不知道也不关心谁在监听 — 这种解耦是核心优势。添加第 6 个订阅者不需要修改发布者。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetDynamicSubscription() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Dynamic subscription: emit an event, then unsubscribe Analytics, then emit again. The second event reaches fewer subscribers — this is how React useEffect cleanup and removeEventListener work.',
    '动态订阅：发送事件，然后取消 Analytics 订阅，再次发送。第二个事件到达更少的订阅者 — React useEffect cleanup 和 removeEventListener 就是这样工作的。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  await emitEvent();
  await delay(500);
  if (!presetRunning || isAborted()) return;
  removeSubscriber();
  await delay(500);
  if (!presetRunning || isAborted()) return;
  await emitEvent();
  await delay(400);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Analytics missed the second event after unsubscribing. Forgetting to unsubscribe causes memory leaks — this is why React warns about updating unmounted components and why RxJS has takeUntil/unsubscribe.',
    'Analytics 取消订阅后错过了第二个事件。忘记取消订阅会导致内存泄漏 — 这就是 React 警告更新已卸载组件以及 RxJS 有 takeUntil/unsubscribe 的原因。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetEventStorm() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Event storm: rapid-fire 5 events. Watch the message queues grow. In production, this is why you need backpressure — RxJS uses operators like throttleTime, debounceTime, and bufferCount.',
    '事件风暴：快速连发 5 个事件。观察消息队列增长。在生产中，这就是为什么需要背压 — RxJS 使用 throttleTime、debounceTime 和 bufferCount 等操作符。',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 5; i++) {
    if (!presetRunning || isAborted()) return;
    await emitEvent();
    await delay(200);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    '5 events broadcast to 3 subscribers = 15 deliveries total. Without throttling, a mousemove handler can fire 60+ events/sec. debounce(300) reduces this to ~3/sec — 20x fewer handler invocations.',
    '5 个事件广播给 3 个订阅者 = 共 15 次投递。不做节流的话，mousemove 处理程序每秒可触发 60+ 次。debounce(300) 将其减少到约 3 次/秒 — 减少 20 倍处理程序调用。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Observer Pattern', '交互式 Observer 模式') }}</div>

    <div class="obs-layout">
      <!-- Publisher -->
      <div class="obs-publisher" :class="{ 'obs-active': broadcasting }">
        <div class="obs-pub-label">{{ t('Publisher', '发布者') }}</div>
        <div v-if="lastEvent" class="obs-event-badge">{{ lastEvent }}</div>
      </div>

      <!-- Fan-out arrows -->
      <div class="obs-arrows">
        <div v-for="sub in subscribers" :key="sub.id" class="obs-arrow">
          <span class="obs-arrow-line" :class="{ 'obs-arrow-active': broadcasting }">→</span>
        </div>
      </div>

      <!-- Subscribers -->
      <div class="obs-subscribers">
        <div
          v-for="sub in subscribers"
          :key="sub.id"
          class="obs-subscriber"
          :class="{ 'obs-sub-receiving': broadcasting }"
        >
          <div class="obs-sub-name">{{ sub.name }}</div>
          <div class="obs-sub-msgs">
            <span v-for="(m, i) in sub.messages.slice(-3)" :key="i" class="obs-msg-tag">{{
              m
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="emitEvent" :disabled="broadcasting">
        {{ t('Emit Event', '发送事件') }}
      </button>
      <button class="viz-btn" @click="addSubscriber" :disabled="broadcasting">
        {{ t('+ Subscribe', '+ 订阅') }}
      </button>
      <button class="viz-btn" @click="removeSubscriber" :disabled="broadcasting">
        {{ t('- Unsubscribe', '- 取消订阅') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetFanOut">{{ t('Fan-Out', 'Fan-Out') }}</button>
      <button class="viz-btn" @click="presetDynamicSubscription">
        {{ t('Unsubscribe', '取消订阅') }}
      </button>
      <button class="viz-btn" @click="presetEventStorm">{{ t('Event Storm', '事件风暴') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
  </div>
</template>

<style scoped>
.obs-layout {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
}

@media (width <= 640px) {
  .obs-layout {
    flex-direction: column;
  }
}

.obs-publisher {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 1rem 1.5rem;
  border: 2px solid var(--viz-primary);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  min-width: 90px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.obs-active {
  border-color: var(--viz-warning);
  box-shadow: 0 0 12px rgb(245 158 11 / 30%);
}

.obs-pub-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-primary);
}

.obs-event-badge {
  padding: 2px 8px;
  border-radius: var(--viz-radius-md);
  background: var(--viz-warning);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  animation: viz-slide-in 0.3s ease;
}

.obs-arrows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--viz-muted);
  font-size: 1.2rem;
}

.obs-arrow-active {
  color: var(--viz-warning);
}

.obs-subscribers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.obs-subscriber {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  transition: border-color 0.2s;
}

.obs-sub-receiving {
  border-color: var(--viz-success);
}

.obs-sub-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--viz-text);
  min-width: 70px;
}

.obs-sub-msgs {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.obs-msg-tag {
  padding: 1px 5px;
  border-radius: var(--viz-radius-sm);
  font-size: 0.65rem;
  font-family: var(--vp-font-family-mono);
  background: var(--viz-primary);
  color: #fff;
}
</style>
