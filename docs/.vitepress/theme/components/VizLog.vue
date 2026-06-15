<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import type { LogEntry } from '../composables/useVizLog';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    entries: LogEntry[];
    maxHeight?: number;
    collapsible?: boolean;
  }>(),
  {
    maxHeight: 160,
    collapsible: true,
  },
);

const emit = defineEmits<{
  clear: [];
}>();

const collapsed = ref(false);
const listRef = ref<HTMLElement | null>(null);
const userScrolled = ref(false);

function scrollToBottom() {
  if (!listRef.value || userScrolled.value) return;
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  });
}

function onScroll() {
  if (!listRef.value) return;
  const { scrollTop, scrollHeight, clientHeight } = listRef.value;
  userScrolled.value = scrollHeight - scrollTop - clientHeight > 8;
}

watch(
  () => props.entries.length,
  () => {
    userScrolled.value = false;
    scrollToBottom();
  },
);

onMounted(scrollToBottom);

function toggle() {
  if (props.collapsible) collapsed.value = !collapsed.value;
}
</script>

<template>
  <div
    class="viz-log"
    :class="{ 'viz-log--collapsed': collapsed }"
    role="region"
    :aria-label="t('Log', '日志')"
  >
    <div
      class="viz-log-header"
      role="button"
      :tabindex="collapsible ? 0 : undefined"
      :aria-expanded="!collapsed"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="viz-log-title">
        <span v-if="collapsible" class="viz-log-arrow" aria-hidden="true">{{
          collapsed ? '▶' : '▼'
        }}</span>
        {{ t('Log', '日志') }}
        <span class="viz-log-count">({{ entries.length }})</span>
      </span>
      <button
        v-if="!collapsed && entries.length > 0"
        class="viz-log-clear"
        @click.stop="emit('clear')"
        :aria-label="t('Clear log', '清除日志')"
      >
        {{ t('Clear', '清除') }}
      </button>
    </div>
    <div
      v-show="!collapsed"
      ref="listRef"
      class="viz-log-entries"
      role="log"
      aria-live="polite"
      :style="{ maxHeight: maxHeight + 'px' }"
      @scroll="onScroll"
    >
      <div
        v-for="entry in entries"
        :key="entry.index"
        class="viz-log-entry"
        :class="'viz-log-entry--' + entry.type"
      >
        <span class="viz-log-index">#{{ entry.index }}</span>
        <span class="viz-log-text">{{ entry.text }}</span>
      </div>
      <div v-if="entries.length === 0" class="viz-log-empty">
        {{ t('No log entries yet', '暂无日志记录') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.viz-log {
  margin-top: 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  overflow: hidden;
}

.viz-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.625rem;
  background: var(--viz-bg);
  border-bottom: 1px solid var(--viz-border);
  cursor: pointer;
  user-select: none;
}

.viz-log--collapsed .viz-log-header {
  border-bottom: none;
}

.viz-log-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--viz-muted);
}

.viz-log-arrow {
  display: inline-block;
  font-size: 0.5625rem;
  margin-right: 0.25rem;
  transition: transform var(--viz-transition);
}

.viz-log-count {
  font-weight: 400;
  opacity: 0.7;
}

.viz-log-clear {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: transparent;
  color: var(--viz-muted);
  font-size: 0.625rem;
  font-family: var(--vp-font-family-base);
  cursor: pointer;
  transition: all var(--viz-transition);
}

.viz-log-clear:hover {
  border-color: var(--viz-danger);
  color: var(--viz-danger);
}

.viz-log-entries {
  overflow-y: auto;
  overscroll-behavior: contain;
}

.viz-log-entry {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  line-height: 1.5;
  border-left: 3px solid transparent;
  animation: viz-slide-in 0.2s ease;
}

.viz-log-entry + .viz-log-entry {
  border-top: 1px solid color-mix(in srgb, var(--viz-border) 50%, transparent);
}

.viz-log-entry--success {
  border-left-color: var(--viz-success);
}

.viz-log-entry--warning {
  border-left-color: var(--viz-warning);
}

.viz-log-entry--error {
  border-left-color: var(--viz-danger);
}

.viz-log-entry--highlight {
  border-left-color: var(--viz-primary);
  background: color-mix(in srgb, var(--viz-primary) 8%, transparent);
}

.viz-log-index {
  flex-shrink: 0;
  color: var(--viz-muted);
  font-size: 0.625rem;
  min-width: 1.75rem;
  opacity: 0.6;
}

.viz-log-text {
  color: var(--viz-text);
  word-break: break-word;
}

.viz-log-empty {
  padding: 0.75rem 0.625rem;
  font-size: 0.75rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
}

.viz-log-entries::-webkit-scrollbar {
  width: 4px;
}

.viz-log-entries::-webkit-scrollbar-track {
  background: transparent;
}

.viz-log-entries::-webkit-scrollbar-thumb {
  background: var(--viz-muted);
  border-radius: 2px;
  opacity: 0.3;
}
</style>
