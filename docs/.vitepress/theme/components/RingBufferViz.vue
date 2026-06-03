<script setup lang="ts">
import { ref, computed } from 'vue';

const SIZE = 8;
const buffer = ref<(string | null)[]>(Array(SIZE).fill(null));
const head = ref(0);
const tail = ref(0);
const count = ref(0);
const message = ref('Click Enqueue to add items');
const nextValue = ref(1);
const animatingIndex = ref(-1);
const animationType = ref<'enqueue' | 'dequeue' | ''>('');

const CX = 140, CY = 140, R = 100;

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
  })
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
    message.value = 'Buffer full! Dequeue first.';
    return;
  }
  const val = `${nextValue.value++}`;
  buffer.value[tail.value] = val;
  animatingIndex.value = tail.value;
  animationType.value = 'enqueue';
  tail.value = (tail.value + 1) % SIZE;
  count.value++;
  message.value = `Enqueued "${val}" → tail moves to ${tail.value}`;
  setTimeout(() => { animatingIndex.value = -1; animationType.value = ''; }, 400);
}

function dequeue() {
  if (count.value <= 0) {
    message.value = 'Buffer empty! Enqueue first.';
    return;
  }
  const val = buffer.value[head.value];
  animatingIndex.value = head.value;
  animationType.value = 'dequeue';
  buffer.value[head.value] = null;
  head.value = (head.value + 1) % SIZE;
  count.value--;
  message.value = `Dequeued "${val}" → head moves to ${head.value}`;
  setTimeout(() => { animatingIndex.value = -1; animationType.value = ''; }, 400);
}

function reset() {
  buffer.value = Array(SIZE).fill(null);
  head.value = 0;
  tail.value = 0;
  count.value = 0;
  nextValue.value = 1;
  animatingIndex.value = -1;
  animationType.value = '';
  message.value = 'Reset! Click Enqueue to start.';
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive Ring Buffer · size={{ SIZE }}</div>
    <div class="ringbuf-layout">
      <svg viewBox="0 0 280 280" class="ringbuf-svg">
        <circle :cx="CX" :cy="CY" :r="R" fill="none" stroke="var(--viz-border)" stroke-width="1" stroke-dasharray="4,4" />

        <g v-for="cell in cells" :key="cell.index">
          <g :transform="`translate(${cell.x}, ${cell.y})`">
            <circle
              r="22"
              :fill="cell.filled ? 'var(--viz-cell-filled)' : 'var(--viz-cell-empty)'"
              :stroke="cell.isHead ? 'var(--viz-success)' : cell.isTail ? 'var(--viz-warning)' : 'transparent'"
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

        <g v-if="count > 0" :transform="`translate(${headPos.x}, ${headPos.y})`" class="ringbuf-pointer">
          <circle r="4" fill="var(--viz-success)" />
        </g>
        <text v-if="count > 0" :x="headLabelPos.x" :y="headLabelPos.y" text-anchor="middle" dominant-baseline="central" fill="var(--viz-success)" font-size="9" font-weight="700">H</text>

        <g :transform="`translate(${tailPos.x}, ${tailPos.y})`" class="ringbuf-pointer">
          <circle r="4" fill="var(--viz-warning)" />
        </g>
        <text :x="tailLabelPos.x" :y="tailLabelPos.y" text-anchor="middle" dominant-baseline="central" fill="var(--viz-warning)" font-size="9" font-weight="700">T</text>

        <text :x="CX" :y="CY - 8" text-anchor="middle" fill="var(--viz-text)" font-size="24" font-weight="700">{{ count }}</text>
        <text :x="CX" :y="CY + 12" text-anchor="middle" fill="var(--viz-muted)" font-size="10">/{{ SIZE }}</text>
      </svg>

      <div class="ringbuf-info">
        <div class="ringbuf-legend">
          <span class="ringbuf-legend-item"><span class="ringbuf-dot ringbuf-dot--head"></span> Head (read)</span>
          <span class="ringbuf-legend-item"><span class="ringbuf-dot ringbuf-dot--tail"></span> Tail (write)</span>
        </div>
        <div class="viz-controls">
          <button class="viz-btn viz-btn--primary" @click="enqueue">Enqueue</button>
          <button class="viz-btn" @click="dequeue">Dequeue</button>
          <button class="viz-btn viz-btn--danger" @click="reset">Reset</button>
        </div>
        <div class="viz-status">{{ message }}</div>
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

.ringbuf-dot--head { background: var(--viz-success); }
.ringbuf-dot--tail { background: var(--viz-warning); }

.ringbuf-cell-pop {
  animation: cell-pop 0.4s ease;
  transform-origin: center;
}

.ringbuf-cell-fade {
  animation: cell-fade 0.4s ease;
}

.ringbuf-pointer {
  transition: transform 0.3s ease;
}

@keyframes cell-pop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}

@keyframes cell-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (max-width: 640px) {
  .ringbuf-layout { flex-direction: column; }
  .ringbuf-svg { width: 200px; height: 200px; }
}
</style>
