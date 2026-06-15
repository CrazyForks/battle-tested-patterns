import { ref } from 'vue';

export function useData() {
  return {
    lang: ref('en-US'),
    isDark: ref(false),
    page: ref({ relativePath: '' }),
    frontmatter: ref({}),
    title: ref(''),
    description: ref(''),
  };
}

export default {};
