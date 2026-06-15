<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
const { t } = useI18n();
</script>

<template>
  <div
    class="viz-container viz-skeleton"
    role="status"
    :aria-label="t('Loading visualization', '加载可视化中')"
  >
    <div class="viz-skel-title"></div>
    <div class="viz-skel-content"></div>
    <div class="viz-skel-controls">
      <div class="viz-skel-btn"></div>
      <div class="viz-skel-btn"></div>
      <div class="viz-skel-btn viz-skel-btn--short"></div>
    </div>
    <div class="viz-skel-status"></div>
  </div>
</template>

<style scoped>
@keyframes viz-shimmer {
  0% {
    background-position: -200% 0;
  }

  100% {
    background-position: 200% 0;
  }
}

.viz-skeleton {
  animation: none;
}

.viz-skel-title,
.viz-skel-content,
.viz-skel-btn,
.viz-skel-status {
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

.viz-skel-content {
  width: 100%;
  height: 120px;
  border-radius: var(--viz-radius-sm);
  margin-bottom: 1rem;
}

.viz-skel-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.viz-skel-btn {
  width: 80px;
  height: 30px;
}

.viz-skel-btn--short {
  width: 56px;
}

.viz-skel-status {
  width: 70%;
  height: 36px;
}
</style>
