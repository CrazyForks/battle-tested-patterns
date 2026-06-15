<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';

const { lang } = useData();
const isZh = computed(() => lang.value.startsWith('zh'));

function scrollToDemo() {
  try {
    const viz = document.querySelector('.viz-container:not(.viz-skeleton)');
    if (viz) {
      viz.scrollIntoView({ behavior: 'smooth', block: 'center' });
      viz.classList.add('viz-highlight');
      setTimeout(() => viz.classList.remove('viz-highlight'), 1500);
    }
  } catch (err) {
    // scrollIntoView / classList are well-supported, but guard defensively so
    // a badge click can never throw an unhandled error that disrupts the page.
    console.error('[DemoBadge] scrollToDemo failed:', err);
  }
}
</script>

<template>
  <a class="demo-badge" @click.prevent="scrollToDemo" href="#interactive-demo">
    <span class="demo-badge-icon">&#9654;</span>
    {{ isZh ? '互动演示' : 'Interactive Demo' }}
    <span class="demo-badge-arrow">↓</span>
  </a>
</template>

<style scoped>
.demo-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1.5px dashed var(--vp-c-brand-1);
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  text-decoration: none !important;
  transition: all var(--viz-transition);
  margin: 0.25rem 0 0.5rem;
  line-height: 1.5;
}

.demo-badge:hover {
  background: var(--vp-c-brand-soft);
  border-style: solid;
  text-decoration: none !important;
}

.demo-badge-icon {
  font-size: 0.625rem;
}

.demo-badge-arrow {
  font-size: 0.75rem;
  animation: demo-bounce 2s ease-in-out infinite;
}

@keyframes demo-bounce {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(2px);
  }
}
</style>

<style>
.viz-highlight {
  box-shadow:
    0 0 0 3px var(--vp-c-brand-soft),
    0 0 12px var(--vp-c-brand-soft);
  transition: box-shadow var(--viz-transition);
}
</style>
