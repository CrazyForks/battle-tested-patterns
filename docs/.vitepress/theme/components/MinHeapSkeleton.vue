<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
const { t } = useI18n();
</script>

<template>
  <div class="viz-container viz-skeleton" role="status" :aria-label="t('Loading visualization', '加载可视化中')">
    <div class="viz-skel-title"></div>

    <div class="heap-skel-tree">
      <svg viewBox="0 0 400 180" class="heap-skel-svg">
        <line x1="200" y1="35" x2="120" y2="85" class="heap-skel-edge" />
        <line x1="200" y1="35" x2="280" y2="85" class="heap-skel-edge" />
        <line x1="120" y1="85" x2="80" y2="135" class="heap-skel-edge" />
        <line x1="120" y1="85" x2="160" y2="135" class="heap-skel-edge" />
        <line x1="280" y1="85" x2="240" y2="135" class="heap-skel-edge" />
        <line x1="280" y1="85" x2="320" y2="135" class="heap-skel-edge" />
        <circle cx="200" cy="35" r="18" class="heap-skel-node" />
        <circle cx="120" cy="85" r="18" class="heap-skel-node" />
        <circle cx="280" cy="85" r="18" class="heap-skel-node" />
        <circle cx="80" cy="135" r="18" class="heap-skel-node" />
        <circle cx="160" cy="135" r="18" class="heap-skel-node" />
        <circle cx="240" cy="135" r="18" class="heap-skel-node" />
        <circle cx="320" cy="135" r="18" class="heap-skel-node" />
      </svg>
    </div>

    <div class="heap-skel-array">
      <div class="heap-skel-cell" v-for="i in 7" :key="i"></div>
    </div>

    <div class="viz-skel-controls">
      <div class="viz-skel-btn"></div>
      <div class="viz-skel-btn"></div>
      <div class="viz-skel-btn viz-skel-btn--danger"></div>
      <div class="heap-skel-slider"></div>
    </div>

    <div class="viz-skel-controls">
      <div class="viz-skel-btn viz-skel-btn--short"></div>
      <div class="viz-skel-btn"></div>
      <div class="viz-skel-btn"></div>
      <div class="viz-skel-btn"></div>
    </div>

    <div class="viz-skel-status"></div>
  </div>
</template>

<style scoped>
@keyframes viz-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.viz-skeleton { animation: none; }

.viz-skel-title,
.viz-skel-btn,
.viz-skel-status,
.heap-skel-cell,
.heap-skel-slider {
  background: linear-gradient(
    90deg,
    var(--viz-cell-empty) 25%,
    color-mix(in srgb, var(--viz-cell-empty) 50%, transparent) 50%,
    var(--viz-cell-empty) 75%
  );
  background-size: 200% 100%;
  animation: viz-shimmer 1.8s ease infinite;
  border-radius: var(--viz-radius-md, 8px);
}

.viz-skel-title {
  width: 40%;
  height: 14px;
  margin-bottom: 1rem;
}

.heap-skel-tree {
  display: flex;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.heap-skel-svg {
  width: 100%;
  max-width: 420px;
  height: auto;
}

.heap-skel-edge {
  stroke: var(--viz-cell-empty);
  stroke-width: 1.5;
}

.heap-skel-node {
  fill: var(--viz-cell-empty);
  stroke: none;
  animation: viz-shimmer 1.8s ease infinite;
}

.heap-skel-array {
  display: flex;
  gap: 2px;
  padding: 0.5rem 0;
}

.heap-skel-cell {
  width: 30px;
  height: 26px;
  border-radius: 3px;
}

.viz-skel-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.viz-skel-btn {
  width: 80px;
  height: 30px;
}

.viz-skel-btn--danger { width: 56px; }
.viz-skel-btn--short { width: 56px; }

.heap-skel-slider {
  width: 100px;
  height: 20px;
  border-radius: 10px;
}

.viz-skel-status {
  width: 90%;
  height: 36px;
}
</style>
