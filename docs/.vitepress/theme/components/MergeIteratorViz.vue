<script setup lang="ts">
import { ref, computed } from 'vue';

interface Iterator {
  label: string;
  items: number[];
  pos: number;
}

const output = ref<number[]>([]);
const message = ref('Press "Next" to pick the minimum head and advance');
const highlightIdx = ref(-1);
const pickedValue = ref<number | null>(null);
const done = ref(false);

const initialData: number[][] = [
  [1, 4, 7, 10, 13],
  [2, 5, 8, 11, 14],
  [3, 6, 9, 12, 15],
];

const iterators = ref<Iterator[]>(
  initialData.map((items, i) => ({
    label: `Iter ${i + 1}`,
    items: [...items],
    pos: 0,
  }))
);

const heads = computed(() =>
  iterators.value.map((it) =>
    it.pos < it.items.length ? it.items[it.pos] : null
  )
);

function next() {
  if (done.value) return;

  let minVal = Infinity;
  let minIdx = -1;
  heads.value.forEach((h, i) => {
    if (h !== null && h < minVal) {
      minVal = h;
      minIdx = i;
    }
  });

  if (minIdx === -1) {
    done.value = true;
    message.value = 'Merge complete! All iterators exhausted.';
    highlightIdx.value = -1;
    pickedValue.value = null;
    return;
  }

  highlightIdx.value = minIdx;
  pickedValue.value = minVal;
  iterators.value[minIdx].pos++;
  output.value.push(minVal);

  const remaining = iterators.value.filter((it) => it.pos < it.items.length).length;
  message.value = `Picked ${minVal} from ${iterators.value[minIdx].label} (min of heads). ${remaining} iterator(s) still active.`;

  if (remaining === 0) {
    done.value = true;
    message.value = `Picked ${minVal}. Merge complete! Output: [${output.value.join(', ')}]`;
  }
}

function autoRun() {
  if (done.value) return;
  const step = () => {
    if (!done.value) {
      next();
      if (!done.value) setTimeout(step, 400);
    }
  };
  step();
}

function reset() {
  iterators.value = initialData.map((items, i) => ({
    label: `Iter ${i + 1}`,
    items: [...items],
    pos: 0,
  }));
  output.value = [];
  highlightIdx.value = -1;
  pickedValue.value = null;
  done.value = false;
  message.value = 'Press "Next" to pick the minimum head and advance';
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive Merge Iterator</div>

    <div class="mi-iterators">
      <div
        v-for="(it, idx) in iterators"
        :key="idx"
        class="mi-row"
        :class="{ 'mi-row--active': highlightIdx === idx }"
      >
        <div class="mi-label">{{ it.label }}</div>
        <div class="mi-cells">
          <div
            v-for="(val, j) in it.items"
            :key="j"
            class="mi-cell"
            :class="{
              'mi-cell--consumed': j < it.pos,
              'mi-cell--head': j === it.pos,
              'mi-cell--picked': j === it.pos - 1 && highlightIdx === idx && pickedValue === val,
              'mi-cell--min': j === it.pos && highlightIdx === idx,
            }"
          >{{ val }}</div>
        </div>
        <div class="mi-head-indicator">
          <template v-if="it.pos < it.items.length">
            head={{ it.items[it.pos] }}
          </template>
          <template v-else>
            <span class="mi-exhausted">done</span>
          </template>
        </div>
      </div>
    </div>

    <div class="mi-merge-arrow">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M12 4 L12 18 M8 14 L12 18 L16 14" stroke="var(--viz-primary)" stroke-width="2" fill="none"/>
      </svg>
      <span>merge (pick min)</span>
    </div>

    <div class="mi-output">
      <div class="mi-output-label">Output</div>
      <div class="mi-output-cells">
        <div
          v-for="(val, i) in output"
          :key="i"
          class="mi-cell mi-cell--output"
          :class="{ 'mi-cell--just-added': i === output.length - 1 }"
        >{{ val }}</div>
        <div v-if="output.length === 0" class="mi-cell mi-cell--empty">...</div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" :disabled="done" @click="next">Next</button>
      <button class="viz-btn" :disabled="done" @click="autoRun">Auto Run</button>
      <button class="viz-btn viz-btn--danger" @click="reset">Reset</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.mi-iterators {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0;
}

.mi-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.mi-row--active {
  border-color: var(--viz-primary);
  background: color-mix(in srgb, var(--viz-primary) 8%, transparent);
}

.mi-label {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  min-width: 3rem;
}

.mi-cells {
  display: flex;
  gap: 3px;
}

.mi-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 32px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  border: 2px solid var(--viz-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--viz-text);
  transition: all 0.25s ease;
}

.mi-cell--consumed {
  background: var(--viz-cell-empty);
  color: var(--viz-muted);
  opacity: 0.35;
  border-color: transparent;
  text-decoration: line-through;
}

.mi-cell--head {
  border-color: var(--viz-warning);
  font-weight: 700;
}

.mi-cell--min {
  border-color: var(--viz-success);
  background: var(--viz-success);
  color: #fff;
  animation: mi-pick 0.4s ease;
}

.mi-cell--output {
  border-color: var(--viz-primary);
  background: color-mix(in srgb, var(--viz-primary) 12%, var(--vp-c-bg));
}

.mi-cell--just-added {
  animation: mi-slide-in 0.35s ease;
}

.mi-cell--empty {
  border-style: dashed;
  color: var(--viz-muted);
}

.mi-head-indicator {
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  white-space: nowrap;
}

.mi-exhausted {
  color: var(--viz-danger);
  font-weight: 600;
}

.mi-merge-arrow {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0;
  font-size: 0.75rem;
  color: var(--viz-primary);
  font-weight: 600;
}

.mi-output {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.mi-output-label {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-success);
  min-width: 3rem;
}

.mi-output-cells {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

@keyframes mi-pick {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

@keyframes mi-slide-in {
  0% { opacity: 0; transform: translateY(-8px); }
  100% { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .mi-cell {
    width: 30px;
    height: 28px;
    font-size: 0.75rem;
  }
  .mi-label,
  .mi-output-label {
    min-width: 2.5rem;
    font-size: 0.6875rem;
  }
}
</style>
