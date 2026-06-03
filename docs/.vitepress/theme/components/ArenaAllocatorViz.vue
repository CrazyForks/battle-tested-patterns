<script setup lang="ts">
import { ref, computed } from 'vue';

interface Allocation {
  id: number;
  offset: number;
  size: number;
  color: string;
  label: string;
}

const ARENA_SIZE = 64;
const COLORS = [
  'var(--viz-primary)',
  'var(--viz-success)',
  'var(--viz-warning)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

let nextId = 1;
let colorIdx = 0;

const pointer = ref(0);
const allocations = ref<Allocation[]>([]);
const message = ref('Arena is empty — click "Allocate" to bump the pointer forward');

const usedBytes = computed(() => pointer.value);
const freeBytes = computed(() => ARENA_SIZE - pointer.value);
const allocCount = computed(() => allocations.value.length);

function randomSize(): number {
  const sizes = [2, 4, 4, 8, 8, 8, 12, 16];
  return sizes[Math.floor(Math.random() * sizes.length)];
}

function allocate() {
  const size = randomSize();
  if (pointer.value + size > ARENA_SIZE) {
    message.value = `Cannot allocate ${size} bytes — only ${freeBytes.value} bytes free. Reset the arena.`;
    return;
  }

  const alloc: Allocation = {
    id: nextId++,
    offset: pointer.value,
    size,
    color: COLORS[colorIdx % COLORS.length],
    label: `#${nextId - 1} (${size}B)`,
  };
  colorIdx++;

  allocations.value = [...allocations.value, alloc];
  pointer.value += size;
  message.value = `Allocated ${size} bytes at offset ${alloc.offset} — pointer now at ${pointer.value}`;
}

function resetArena() {
  pointer.value = 0;
  allocations.value = [];
  nextId = 1;
  colorIdx = 0;
  message.value = 'Arena reset — all memory freed at once (O(1) deallocation)';
}

function slotState(index: number): Allocation | null {
  return allocations.value.find(a => index >= a.offset && index < a.offset + a.size) || null;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive Arena Allocator</div>

    <!-- Stats -->
    <div class="arena-stats">
      <div class="arena-stat">
        <span class="arena-stat-value arena-stat--primary">{{ usedBytes }}</span>
        <span class="viz-label">Used</span>
      </div>
      <div class="arena-stat">
        <span class="arena-stat-value arena-stat--success">{{ freeBytes }}</span>
        <span class="viz-label">Free</span>
      </div>
      <div class="arena-stat">
        <span class="arena-stat-value">{{ ARENA_SIZE }}</span>
        <span class="viz-label">Total</span>
      </div>
      <div class="arena-stat">
        <span class="arena-stat-value">{{ allocCount }}</span>
        <span class="viz-label">Allocations</span>
      </div>
    </div>

    <!-- Arena bar -->
    <div class="arena-bar-wrap">
      <div class="arena-bar">
        <div
          v-for="i in ARENA_SIZE"
          :key="i - 1"
          class="arena-cell"
          :class="{
            'arena-cell--pointer': i - 1 === pointer,
            'arena-cell--filled': slotState(i - 1) !== null,
          }"
          :style="slotState(i - 1) ? { background: slotState(i - 1)!.color } : {}"
        ></div>
      </div>

      <!-- Pointer indicator -->
      <div class="arena-pointer-track">
        <div
          class="arena-pointer-marker"
          :style="{ left: (pointer / ARENA_SIZE) * 100 + '%' }"
        >
          <div class="arena-pointer-arrow"></div>
          <div class="arena-pointer-label">ptr={{ pointer }}</div>
        </div>
      </div>
    </div>

    <!-- Allocation legend -->
    <div v-if="allocations.length > 0" class="arena-legend">
      <div
        v-for="alloc in allocations"
        :key="alloc.id"
        class="arena-legend-item"
      >
        <span class="arena-legend-swatch" :style="{ background: alloc.color }"></span>
        <span class="arena-legend-text">{{ alloc.label }} @{{ alloc.offset }}</span>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="allocate">Allocate</button>
      <button class="viz-btn viz-btn--danger" @click="resetArena">Reset Arena</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.arena-stats {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.arena-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 56px;
}

.arena-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.arena-stat--primary { color: var(--viz-primary); }
.arena-stat--success { color: var(--viz-success); }

.arena-bar-wrap {
  margin: 1rem 0 0.5rem;
  position: relative;
}

.arena-bar {
  display: flex;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  overflow: hidden;
  height: 32px;
}

.arena-cell {
  flex: 1;
  background: var(--viz-cell-empty);
  border-right: 1px solid var(--viz-border);
  transition: background 0.3s ease;
}

.arena-cell:last-child {
  border-right: none;
}

.arena-cell--filled {
  animation: arena-fill 0.3s ease;
}

.arena-pointer-track {
  position: relative;
  height: 28px;
  margin-top: 2px;
}

.arena-pointer-marker {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: left 0.3s ease;
}

.arena-pointer-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 6px solid var(--viz-danger);
}

.arena-pointer-label {
  font-size: 0.625rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-danger);
  white-space: nowrap;
}

.arena-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin: 0.5rem 0;
}

.arena-legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.arena-legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.arena-legend-text {
  font-size: 0.625rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

@keyframes arena-fill {
  from { opacity: 0; transform: scaleY(0.5); }
  to { opacity: 1; transform: scaleY(1); }
}

@media (max-width: 640px) {
  .arena-bar { height: 24px; }
}
</style>
