<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';

const { frontmatter, lang } = useData();
const isZh = computed(() => lang.value.startsWith('zh'));

const difficulty = computed(() => frontmatter.value.difficulty || '');

const label = computed(() => {
  const labels = {
    beginner: isZh.value ? '入门' : 'Beginner',
    intermediate: isZh.value ? '进阶' : 'Intermediate',
    advanced: isZh.value ? '高级' : 'Advanced',
  };
  return labels[difficulty.value] || difficulty.value;
});
</script>

<template>
  <span v-if="difficulty" :class="['difficulty-badge', `difficulty-${difficulty}`]">
    {{ label }}
  </span>
</template>

<style scoped>
.difficulty-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 999px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  margin: 0.25rem 0.375rem 0.5rem 0;
  vertical-align: middle;
}

.difficulty-beginner {
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green-2);
  border: 1px solid var(--vp-c-green-dimm-1, rgb(16 185 129 / 20%));
}

.difficulty-intermediate {
  background: var(--vp-c-yellow-soft);
  color: var(--vp-c-yellow-2);
  border: 1px solid var(--vp-c-yellow-dimm-1, rgb(234 179 8 / 20%));
}

.difficulty-advanced {
  background: var(--vp-c-red-soft);
  color: var(--vp-c-red-2);
  border: 1px solid var(--vp-c-red-dimm-1, rgb(244 63 94 / 20%));
}
</style>
