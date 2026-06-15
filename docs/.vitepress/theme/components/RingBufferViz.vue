<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, safeTimeout, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

const SIZE = 8;
const buffer = ref<(string | null)[]>(Array(SIZE).fill(null));
const head = ref(0);
const tail = ref(0);
const count = ref(0);

interface RingSnapshot {
  buffer: (string | null)[];
  head: number;
  tail: number;
  count: number;
  nextVal: number;
}
const history = useVizHistory<RingSnapshot>(
  { buffer: Array(SIZE).fill(null), head: 0, tail: 0, count: 0, nextVal: 1 },
  {
    getMessage: () => message.value,
    onRestore: (s, msg) => {
      presetRunning = false;
      buffer.value = [...s.buffer];
      head.value = s.head;
      tail.value = s.tail;
      count.value = s.count;
      nextValue.value = s.nextVal;
      animatingIndex.value = -1;
      animationType.value = '';
      if (msg !== undefined) message.value = msg;
    },
  },
);

function commitSnapshot(label: string) {
  history.commit(
    {
      buffer: [...buffer.value],
      head: head.value,
      tail: tail.value,
      count: count.value,
      nextVal: nextValue.value,
    },
    label,
  );
}
const message = ref(
  t(
    'Click Enqueue to add items — or pick a scenario to see circular reuse in action',
    '点击"入队"添加元素 — 或选择场景观看循环复用过程',
  ),
);
const nextValue = ref(1);
const animatingIndex = ref(-1);
const animationType = ref<'enqueue' | 'dequeue' | ''>('');
let presetRunning = false;

const CX = 140,
  CY = 140,
  R = 100;

const cells = computed(() =>
  Array.from({ length: SIZE }, (_, i) => {
    const angle = (i / SIZE) * 2 * Math.PI - Math.PI / 2;
    return {
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
      value: buffer.value[i],
      isHead: i === head.value && count.value > 0,
      isTail: i === tail.value,
      filled: buffer.value[i] !== null,
      index: i,
    };
  }),
);

function pointerPos(index: number, offset: number) {
  const angle = (index / SIZE) * 2 * Math.PI - Math.PI / 2;
  return { x: CX + offset * Math.cos(angle), y: CY + offset * Math.sin(angle) };
}

const headPos = computed(() => pointerPos(head.value, 135));
const tailPos = computed(() => pointerPos(tail.value, 135));
const headLabelPos = computed(() => pointerPos(head.value, 158));
const tailLabelPos = computed(() => pointerPos(tail.value, 158));

function enqueue() {
  if (count.value >= SIZE) {
    message.value = t(
      'Buffer full! Must dequeue first. In io_uring, this would trigger backpressure on the producer.',
      '缓冲区已满！必须先出队。在 io_uring 中，这会对生产者触发背压。',
    );
    log(message.value, 'warning');
    return;
  }
  const val = `${nextValue.value++}`;
  buffer.value[tail.value] = val;
  animatingIndex.value = tail.value;
  animationType.value = 'enqueue';
  const oldTail = tail.value;
  tail.value = (tail.value + 1) % SIZE;
  count.value++;
  message.value = t(
    `Enqueued "${val}" at slot ${oldTail}. Tail wraps: ${oldTail} → ${tail.value} (mod ${SIZE}). No allocation needed — slot reuse is the key insight.`,
    `在槽 ${oldTail} 入队 "${val}"。尾指针回绕：${oldTail} → ${tail.value}（mod ${SIZE}）。无需分配 — 槽位复用是核心洞察。`,
  );
  log(message.value, 'info');
  safeTimeout(() => {
    animatingIndex.value = -1;
    animationType.value = '';
  }, 400);
  commitSnapshot(`enqueue("${val}")`);
}

function dequeue() {
  if (count.value <= 0) {
    message.value = t('Buffer empty! Enqueue first.', '缓冲区为空！请先入队。');
    log(message.value, 'warning');
    return;
  }
  const val = buffer.value[head.value];
  animatingIndex.value = head.value;
  animationType.value = 'dequeue';
  buffer.value[head.value] = null;
  const oldHead = head.value;
  head.value = (head.value + 1) % SIZE;
  count.value--;
  message.value = t(
    `Dequeued "${val}" from slot ${oldHead}. Head advances: ${oldHead} → ${head.value}. The slot is now free for reuse — zero-copy, O(1).`,
    `从槽 ${oldHead} 出队 "${val}"。头指针前进：${oldHead} → ${head.value}。该槽位现在可以复用 — 零拷贝，O(1)。`,
  );
  log(message.value, 'info');
  safeTimeout(() => {
    animatingIndex.value = -1;
    animationType.value = '';
  }, 400);
  commitSnapshot(`dequeue`);
}

function reset() {
  clearAll();
  buffer.value = Array(SIZE).fill(null);
  head.value = 0;
  tail.value = 0;
  count.value = 0;
  nextValue.value = 1;
  animatingIndex.value = -1;
  animationType.value = '';
  presetRunning = false;
  message.value = t('Reset! Click Enqueue to start.', '已重置！点击"入队"开始。');
  clearLog();
  history.reset();
}

async function presetFillDrain() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  for (let i = 0; i < SIZE; i++) {
    if (!presetRunning || isAborted()) return;
    enqueue();
    await delay(500);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Buffer full! Now draining — watch the head pointer chase the tail around the ring.',
    '缓冲区已满！现在排空 — 观察头指针绕环追赶尾指针。',
  );
  log(message.value, 'highlight');
  await delay(800);
  for (let i = 0; i < SIZE; i++) {
    if (!presetRunning || isAborted()) return;
    dequeue();
    await delay(500);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Fill & drain complete. Head caught up with tail — both back at start. The ring structure means memory is always reused.',
    '填充和排空完成。头指针追上尾指针 — 两者回到起点。环形结构意味着内存始终被复用。',
  );
  log(message.value, 'success');
  presetRunning = false;
}

async function presetProducerConsumer() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  const ops = ['E', 'E', 'D', 'E', 'E', 'D', 'E', 'D', 'D', 'E', 'E', 'D'];
  for (const op of ops) {
    if (!presetRunning || isAborted()) return;
    if (op === 'E') enqueue();
    else dequeue();
    await delay(600);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Producer-consumer pattern: producer enqueues faster than consumer dequeues. This is how LMAX Disruptor achieves millions of ops/sec.',
    '生产者-消费者模式：生产者入队速度快于消费者出队。LMAX Disruptor 就是这样实现百万级 ops/sec。',
  );
  log(message.value, 'success');
  log(
    t(
      'Interleaved produce/consume keeps the buffer from filling up — balanced rates are key to avoiding backpressure.',
      '交替生产/消费防止缓冲区填满 — 平衡的速率是避免背压的关键。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetOverflow() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  for (let i = 0; i < SIZE; i++) {
    if (!presetRunning || isAborted()) return;
    enqueue();
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  await delay(400);
  if (!presetRunning || isAborted()) return;
  enqueue();
  message.value = t(
    'Overflow rejected! Fixed size = predictable memory. In io_uring, overflow triggers CQ overflow handling. This is the trade-off: bounded memory vs. unbounded queues.',
    '溢出被拒绝！固定大小 = 可预测的内存。在 io_uring 中，溢出会触发 CQ 溢出处理。这就是权衡：有界内存 vs 无界队列。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">
      {{ t('Interactive Ring Buffer', '交互式环形缓冲区') }} · size={{ SIZE }}
    </div>
    <div class="ringbuf-layout">
      <svg
        viewBox="0 0 280 280"
        class="ringbuf-svg"
        role="img"
        :aria-label="t('Ring buffer visualization', '环形缓冲区可视化')"
      >
        <circle
          :cx="CX"
          :cy="CY"
          :r="R"
          fill="none"
          stroke="var(--viz-border)"
          stroke-width="1"
          stroke-dasharray="4,4"
        />

        <g v-for="cell in cells" :key="cell.index">
          <g :transform="`translate(${cell.x}, ${cell.y})`">
            <circle
              r="22"
              :fill="cell.filled ? 'var(--viz-cell-filled)' : 'var(--viz-cell-empty)'"
              :stroke="
                cell.isHead
                  ? 'var(--viz-success)'
                  : cell.isTail
                    ? 'var(--viz-warning)'
                    : 'transparent'
              "
              :stroke-width="cell.isHead || cell.isTail ? 2.5 : 0"
              :class="{
                'ringbuf-cell-pop': animatingIndex === cell.index && animationType === 'enqueue',
                'ringbuf-cell-fade': animatingIndex === cell.index && animationType === 'dequeue',
              }"
            />
            <text
              text-anchor="middle"
              dominant-baseline="central"
              :fill="cell.filled ? '#fff' : 'var(--viz-muted)'"
              font-size="12"
              font-weight="600"
              font-family="var(--vp-font-family-mono)"
            >
              {{ cell.filled ? cell.value : cell.index }}
            </text>
          </g>
        </g>

        <g
          v-if="count > 0"
          :transform="`translate(${headPos.x}, ${headPos.y})`"
          class="ringbuf-pointer"
        >
          <circle r="4" fill="var(--viz-success)" />
        </g>
        <text
          v-if="count > 0"
          :x="headLabelPos.x"
          :y="headLabelPos.y"
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--viz-success)"
          font-size="9"
          font-weight="700"
        >
          H
        </text>

        <g :transform="`translate(${tailPos.x}, ${tailPos.y})`" class="ringbuf-pointer">
          <circle r="4" fill="var(--viz-warning)" />
        </g>
        <text
          :x="tailLabelPos.x"
          :y="tailLabelPos.y"
          text-anchor="middle"
          dominant-baseline="central"
          fill="var(--viz-warning)"
          font-size="9"
          font-weight="700"
        >
          T
        </text>

        <text
          :x="CX"
          :y="CY - 8"
          text-anchor="middle"
          fill="var(--viz-text)"
          font-size="24"
          font-weight="700"
        >
          {{ count }}
        </text>
        <text :x="CX" :y="CY + 12" text-anchor="middle" fill="var(--viz-muted)" font-size="10">
          /{{ SIZE }}
        </text>
      </svg>

      <div class="ringbuf-info">
        <div class="ringbuf-legend">
          <span class="ringbuf-legend-item"
            ><span class="ringbuf-dot ringbuf-dot--head"></span>
            {{ t('Head (read)', 'Head（读取）') }}</span
          >
          <span class="ringbuf-legend-item"
            ><span class="ringbuf-dot ringbuf-dot--tail"></span>
            {{ t('Tail (write)', 'Tail（写入）') }}</span
          >
        </div>
        <div class="viz-controls">
          <button class="viz-btn viz-btn--primary" @click="enqueue">
            {{ t('Enqueue', '入队') }}
          </button>
          <button class="viz-btn" @click="dequeue">{{ t('Dequeue', '出队') }}</button>
          <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
          <div class="viz-speed">
            <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
            <span class="viz-speed-val">{{ speed }}x</span>
          </div>
        </div>
        <div class="viz-presets">
          <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
          <button class="viz-btn" @click="presetFillDrain">
            {{ t('Fill & Drain', '填充排空') }}
          </button>
          <button class="viz-btn" @click="presetProducerConsumer">
            {{ t('Producer-Consumer', '生产消费') }}
          </button>
          <button class="viz-btn" @click="presetOverflow">{{ t('Overflow', '溢出') }}</button>
        </div>
        <div class="viz-status" aria-live="polite">{{ message }}</div>
        <VizPlaybackBar :history="history" :speed="speed" />
        <VizLog :entries="logEntries" @clear="clearLog" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ringbuf-layout {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.ringbuf-svg {
  width: 220px;
  height: 220px;
  flex-shrink: 0;
  max-width: 100%;
}

.ringbuf-info {
  flex: 1;
  min-width: 180px;
}

.ringbuf-legend {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.ringbuf-legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--viz-text);
}

.ringbuf-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.ringbuf-dot--head {
  background: var(--viz-success);
}

.ringbuf-dot--tail {
  background: var(--viz-warning);
}

.ringbuf-cell-pop {
  animation: viz-pulse 0.4s ease;
  transform-origin: center;
}

.ringbuf-cell-fade {
  animation: viz-fade 0.4s ease;
}

.ringbuf-pointer {
  transition: transform var(--viz-transition);
}

@media (width <= 640px) {
  .ringbuf-layout {
    flex-direction: column;
  }

  .ringbuf-svg {
    width: 200px;
    height: 200px;
  }
}
</style>
