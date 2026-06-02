import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Battle-Tested Patterns',
  description:
    'Battle-tested programming patterns from production codebases. Multi-language examples, precise source links, interactive playground.',

  base: '/battle-tested-patterns/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/battle-tested-patterns/logo.svg' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/what-is-this' },
      { text: 'Patterns', link: '/patterns/bitmask/' },
      { text: 'By Project', link: '/by-project/react' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is This?', link: '/guide/what-is-this' },
            { text: 'How to Contribute', link: '/guide/how-to-contribute' },
          ],
        },
      ],
      '/patterns/': [
        {
          text: 'Patterns',
          items: [
            { text: 'Bitmask', link: '/patterns/bitmask/' },
            { text: 'Double Buffering', link: '/patterns/double-buffering/' },
            { text: 'Cooperative Scheduling', link: '/patterns/cooperative-scheduling/' },
            { text: 'Min Heap', link: '/patterns/min-heap/' },
            { text: 'Diff / Patch', link: '/patterns/diff-patch/' },
          ],
        },
      ],
      '/by-project/': [
        {
          text: 'By Source Project',
          items: [
            { text: 'React', link: '/by-project/react' },
            { text: 'Linux Kernel', link: '/by-project/linux' },
            { text: 'Go Runtime', link: '/by-project/go-runtime' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Totoro-jam/battle-tested-patterns' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/Totoro-jam/battle-tested-patterns/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Totoro-jam',
    },
  },
});
