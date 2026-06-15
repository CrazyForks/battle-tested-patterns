<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
const { t } = useI18n();
</script>

<template>
  <div
    class="viz-container viz-skeleton tl-skel"
    role="status"
    :aria-label="t('Loading timeline', '加载时间线中')"
  >
    <div class="viz-skel-title"></div>

    <div class="tl-skel-stats">
      <div class="tl-skel-stat" v-for="i in 3" :key="i">
        <div class="tl-skel-stat-value"></div>
        <div class="tl-skel-stat-label"></div>
      </div>
    </div>

    <div class="tl-skel-filters">
      <div
        class="tl-skel-pill"
        v-for="i in 6"
        :key="i"
        :style="{ width: i === 1 ? '52px' : `${56 + (i % 3) * 16}px` }"
      ></div>
    </div>

    <div class="tl-skel-status"></div>

    <div class="tl-skel-timeline">
      <div class="tl-skel-line"></div>
      <div class="tl-skel-decade">
        <div class="tl-skel-decade-label"></div>
      </div>
      <div
        v-for="i in 6"
        :key="i"
        class="tl-skel-entry"
        :class="i % 2 === 0 ? 'tl-skel-entry--left' : 'tl-skel-entry--right'"
      >
        <div class="tl-skel-node"></div>
        <div class="tl-skel-card">
          <div class="tl-skel-card-year"></div>
          <div class="tl-skel-card-name"></div>
          <div class="tl-skel-card-origin"></div>
        </div>
      </div>
      <div class="tl-skel-decade">
        <div class="tl-skel-decade-label"></div>
      </div>
      <div
        v-for="i in 4"
        :key="'b' + i"
        class="tl-skel-entry"
        :class="i % 2 === 0 ? 'tl-skel-entry--left' : 'tl-skel-entry--right'"
      >
        <div class="tl-skel-node"></div>
        <div class="tl-skel-card">
          <div class="tl-skel-card-year"></div>
          <div class="tl-skel-card-name"></div>
          <div class="tl-skel-card-origin"></div>
        </div>
      </div>
    </div>
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

.tl-skel {
  max-width: 720px;
  margin: 0 auto;
}

.viz-skel-title,
.tl-skel-stat-value,
.tl-skel-stat-label,
.tl-skel-pill,
.tl-skel-status,
.tl-skel-decade-label,
.tl-skel-node,
.tl-skel-card-year,
.tl-skel-card-name,
.tl-skel-card-origin {
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
  width: 50%;
  height: 14px;
  margin: 0 auto 1rem;
}

.tl-skel-stats {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.tl-skel-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.tl-skel-stat-value {
  width: 40px;
  height: 24px;
  border-radius: var(--viz-radius-sm);
}

.tl-skel-stat-label {
  width: 52px;
  height: 12px;
  border-radius: var(--viz-radius-sm);
}

.tl-skel-filters {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1rem;
}

.tl-skel-pill {
  height: 26px;
  border-radius: 999px;
}

.tl-skel-status {
  width: 60%;
  height: 14px;
  margin: 0 auto 1.25rem;
}

.tl-skel-timeline {
  position: relative;
  padding: 0 0 1rem;
}

.tl-skel-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--viz-cell-empty);
  transform: translateX(-50%);
}

.tl-skel-decade {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.tl-skel-decade-label {
  width: 60px;
  height: 24px;
  border-radius: 999px;
  z-index: 2;
}

.tl-skel-entry {
  position: relative;
  display: flex;
  margin-bottom: 0.5rem;
  min-height: 56px;
}

.tl-skel-entry--left {
  flex-direction: row-reverse;
}

.tl-skel-node {
  position: absolute;
  left: 50%;
  top: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.tl-skel-card {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--viz-cell-empty);
  border-radius: var(--viz-radius-sm);
  max-width: calc(50% - 20px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tl-skel-entry--left .tl-skel-card {
  margin-right: calc(50% + 14px);
  margin-left: 0;
}

.tl-skel-entry--right .tl-skel-card {
  margin-left: calc(50% + 14px);
  margin-right: 0;
}

.tl-skel-card-year {
  width: 36px;
  height: 11px;
  border-radius: var(--viz-radius-sm);
}

.tl-skel-card-name {
  width: 100px;
  height: 13px;
  border-radius: var(--viz-radius-sm);
}

.tl-skel-card-origin {
  width: 140px;
  height: 11px;
  border-radius: var(--viz-radius-sm);
}

@media (width <= 640px) {
  .tl-skel-line {
    left: 16px;
  }

  .tl-skel-decade {
    justify-content: flex-start;
    padding-left: 16px;
  }

  .tl-skel-decade-label {
    transform: none;
  }

  .tl-skel-node {
    left: 16px;
  }

  .tl-skel-entry,
  .tl-skel-entry--left {
    flex-direction: row;
  }

  .tl-skel-entry--left .tl-skel-card,
  .tl-skel-entry--right .tl-skel-card {
    margin-left: 38px;
    margin-right: 0;
    max-width: calc(100% - 44px);
  }
}
</style>
