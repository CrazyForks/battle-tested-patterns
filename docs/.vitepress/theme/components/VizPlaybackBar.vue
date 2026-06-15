<script setup lang="ts">
/**
 * VizPlaybackBar — Universal playback control bar for Viz components.
 *
 * Provides: Skip to start / Step back / Play-Pause / Step forward / Skip to end
 * + progress scrubber + step counter.
 *
 * Follows USFCA/VisuAlgo standard layout. Appears after first user action
 * (progressive disclosure). Keyboard: ←/→ step, Space play/pause.
 *
 * Icons are inline SVG (Lucide-style stroke paths) using `currentColor` so they
 * stay crisp and theme-aware — no emoji (which render inconsistently across OSes)
 * and no icon-library dependency (only five glyphs are needed). This matches the
 * project's existing convention of inlining SVG in the Viz components.
 */
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import type { VizHistory } from '../composables/useVizHistory';

const props = defineProps<{
  history: VizHistory<any>;
  speed?: number;
}>();

const { t } = useI18n();

const progress = computed(() =>
  props.history.totalSteps.value > 1
    ? props.history.currentIndex.value / (props.history.totalSteps.value - 1)
    : 0,
);

// Fill the scrubber track up to the current position (percentage for gradient).
const progressPct = computed(() => `${(progress.value * 100).toFixed(2)}%`);

function onScrub(e: Event) {
  const input = e.target as HTMLInputElement;
  const idx = Math.round(parseFloat(input.value) * (props.history.totalSteps.value - 1));
  props.history.goto(idx);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      props.history.undo();
      break;
    case 'ArrowRight':
      e.preventDefault();
      props.history.redo();
      break;
    case ' ':
      e.preventDefault();
      if (props.history.isPlaying.value) props.history.pause();
      else props.history.play();
      break;
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown));
onUnmounted(() => document.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <div
    v-if="history.totalSteps.value > 1"
    class="viz-playback"
    role="toolbar"
    :aria-label="t('Playback controls', '播放控制')"
  >
    <!-- Skip to start -->
    <button
      class="viz-playback__btn"
      :disabled="!history.canUndo.value"
      :aria-label="t('Skip to start', '跳到开头')"
      :title="t('Skip to start', '跳到开头')"
      @click="history.goto(0)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
        <line x1="5" y1="19" x2="5" y2="5" />
      </svg>
    </button>

    <!-- Step back -->
    <button
      class="viz-playback__btn"
      :disabled="!history.canUndo.value"
      :aria-label="t('Step back', '后退一步')"
      :title="t('Step back', '后退一步')"
      @click="history.undo()"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>

    <!-- Play / Pause -->
    <button
      class="viz-playback__btn viz-playback__btn--play"
      :aria-label="history.isPlaying.value ? t('Pause', '暂停') : t('Play', '播放')"
      :title="history.isPlaying.value ? t('Pause', '暂停') : t('Play', '播放')"
      @click="history.isPlaying.value ? history.pause() : history.play()"
    >
      <svg v-if="history.isPlaying.value" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
        <polygon points="7 4 20 12 7 20 7 4" />
      </svg>
    </button>

    <!-- Step forward -->
    <button
      class="viz-playback__btn"
      :disabled="!history.canRedo.value"
      :aria-label="t('Step forward', '前进一步')"
      :title="t('Step forward', '前进一步')"
      @click="history.redo()"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>

    <!-- Skip to end -->
    <button
      class="viz-playback__btn"
      :disabled="!history.canRedo.value"
      :aria-label="t('Skip to end', '跳到末尾')"
      :title="t('Skip to end', '跳到末尾')"
      @click="history.goto(history.totalSteps.value - 1)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
        <line x1="19" y1="5" x2="19" y2="19" />
      </svg>
    </button>

    <!-- Scrubber -->
    <input
      type="range"
      class="viz-playback__scrubber"
      :style="{ '--viz-playback-fill': progressPct }"
      min="0"
      max="1"
      step="0.001"
      :value="progress"
      :aria-label="t('Progress', '进度')"
      :title="t('Progress', '进度')"
      :aria-valuetext="`${history.currentIndex.value + 1} / ${history.totalSteps.value}`"
      @input="onScrub"
    />

    <!-- Step counter -->
    <span
      class="viz-playback__counter"
      :title="t('Current step / total steps', '当前步 / 总步数')"
    >
      {{ history.currentIndex.value + 1 }}/{{ history.totalSteps.value }}
    </span>
  </div>
</template>

<style scoped>
/* Minimal playback bar — Apple Music-inspired: thin track, subtle controls,
   blends with viz-container without competing for attention. */
.viz-playback {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0;
  margin-top: 0.625rem;
  border-top: 1px solid var(--viz-border, #e2e8f0);
}

.viz-playback__btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--viz-radius-sm, 6px);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--viz-muted, #64748b);
  transition: all var(--viz-transition, 250ms ease);
  user-select: none;
  padding: 0;
}

.viz-playback__btn svg {
  width: 16px;
  height: 16px;
  display: block;
}

.viz-playback__btn:hover:not(:disabled) {
  background: var(--vp-c-bg-soft, #f5f5f7);
  color: var(--viz-text, #1e293b);
}

.viz-playback__btn:active:not(:disabled) {
  transform: scale(0.9);
  transition-duration: 80ms;
}

.viz-playback__btn:focus-visible {
  outline: 2px solid var(--viz-primary, #3b82f6);
  outline-offset: 2px;
}

.viz-playback__btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.viz-playback__btn--play {
  width: 32px;
  height: 32px;
  color: var(--viz-primary, #3b82f6);
}

.viz-playback__btn--play svg {
  width: 18px;
  height: 18px;
}

.viz-playback__btn--play:hover:not(:disabled) {
  background: color-mix(in srgb, var(--viz-primary, #3b82f6) 10%, transparent);
  color: var(--viz-primary, #3b82f6);
}

/* Scrubber: thin 2px track with a filled "played" portion + 10px thumb. */
.viz-playback__scrubber {
  flex: 1;
  min-width: 40px;
  height: 20px;
  margin: 0 0.375rem;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  /* Fallback fill (set inline per-instance via --viz-playback-fill) */
  --viz-playback-fill: 0%;
}

.viz-playback__scrubber::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 2px;
  /* Played portion in primary, remainder in border color */
  background: linear-gradient(
    to right,
    var(--viz-primary, #3b82f6) var(--viz-playback-fill),
    var(--viz-border, #e2e8f0) var(--viz-playback-fill)
  );
}

.viz-playback__scrubber::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 11px;
  height: 11px;
  margin-top: -4px;
  border-radius: 50%;
  background: var(--viz-primary, #3b82f6);
  border: 2px solid var(--vp-c-bg, #fff);
  box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease;
}

.viz-playback__scrubber:hover::-webkit-slider-thumb {
  transform: scale(1.25);
}

/* Firefox */
.viz-playback__scrubber::-moz-range-track {
  height: 3px;
  border-radius: 2px;
  background: var(--viz-border, #e2e8f0);
  border: none;
}

.viz-playback__scrubber::-moz-range-progress {
  height: 3px;
  border-radius: 2px;
  background: var(--viz-primary, #3b82f6);
}

.viz-playback__scrubber::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--viz-primary, #3b82f6);
  border: 2px solid var(--vp-c-bg, #fff);
  box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.2);
}

.viz-playback__counter {
  font-family: var(--vp-font-family-mono, monospace);
  font-size: 0.6875rem;
  color: var(--viz-muted, #64748b);
  white-space: nowrap;
  min-width: 34px;
  text-align: right;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

/* Mobile: Apple HIG 44px touch targets (aligns with custom.css). */
@media (max-width: 640px) {
  .viz-playback {
    gap: 0.125rem;
  }
  .viz-playback__btn {
    width: 44px;
    height: 44px;
  }
  .viz-playback__btn svg {
    width: 20px;
    height: 20px;
  }
  .viz-playback__btn--play {
    width: 46px;
    height: 46px;
  }
  .viz-playback__btn--play svg {
    width: 22px;
    height: 22px;
  }
  .viz-playback__scrubber {
    height: 44px;
  }
}
</style>
