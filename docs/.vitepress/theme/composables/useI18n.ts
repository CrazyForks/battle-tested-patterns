import { computed } from 'vue';
import { useData } from 'vitepress';

export function useI18n() {
  const { lang } = useData();
  const isZh = computed(() => lang.value === 'zh-CN');

  function t(en: string, zh: string): string {
    return isZh.value ? zh : en;
  }

  return { isZh, t };
}
