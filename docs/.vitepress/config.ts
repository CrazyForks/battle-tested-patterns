import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(defineConfig({
  title: 'Battle-Tested Patterns',
  description:
    'Battle-tested programming patterns from production codebases. Multi-language examples, precise source links, interactive playground.',

  base: '/battle-tested-patterns/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/battle-tested-patterns/favicon.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Battle-Tested Patterns' }],
    ['meta', { property: 'og:title', content: 'Battle-Tested Patterns — Code from React, Linux, Go & More' }],
    ['meta', { property: 'og:description', content: '30+ production-proven patterns with precise source links, multi-language implementations, exercises, and challenge questions.' }],
    ['meta', { property: 'og:image', content: 'https://totoro-jam.github.io/battle-tested-patterns/og-image.png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '631' }],
    ['meta', { property: 'og:url', content: 'https://totoro-jam.github.io/battle-tested-patterns/' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:locale:alternate', content: 'zh_CN' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'Battle-Tested Patterns — Code from React, Linux, Go & More' }],
    ['meta', { name: 'twitter:description', content: '30+ production-proven patterns with precise source links, multi-language implementations, and exercises.' }],
    ['meta', { name: 'twitter:image', content: 'https://totoro-jam.github.io/battle-tested-patterns/og-image.png' }],
    ['meta', { name: 'author', content: 'Totoro-jam' }],
    ['meta', { name: 'keywords', content: 'programming patterns, design patterns, system design, data structures, algorithms, React, Linux, Go, Rust, TypeScript, Python, Redis, PostgreSQL, Kafka, interview preparation, computer science' }],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
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
                { text: 'Pattern Connections', link: '/guide/pattern-connections' },
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
                { text: 'Object Pool', link: '/patterns/object-pool/' },
                { text: 'Ring Buffer', link: '/patterns/ring-buffer/' },
                { text: 'State Machine', link: '/patterns/state-machine/' },
                { text: 'Copy-on-Write', link: '/patterns/copy-on-write/' },
                { text: 'Observer / Pub-Sub', link: '/patterns/observer/' },
                { text: 'Iterator / Lazy Eval', link: '/patterns/iterator/' },
                { text: 'Semaphore', link: '/patterns/semaphore/' },
                { text: 'Batch Processing', link: '/patterns/batch-processing/' },
                { text: 'Retry with Backoff', link: '/patterns/retry-backoff/' },
                { text: 'Flyweight / Interning', link: '/patterns/flyweight/' },
                { text: 'Bloom Filter', link: '/patterns/bloom-filter/' },
                { text: 'Circuit Breaker', link: '/patterns/circuit-breaker/' },
                { text: 'Arena Allocator', link: '/patterns/arena-allocator/' },
                { text: 'Backpressure', link: '/patterns/backpressure/' },
                { text: 'Write-Ahead Log', link: '/patterns/write-ahead-log/' },
                { text: 'LRU Cache', link: '/patterns/lru-cache/' },
                { text: 'Consistent Hashing', link: '/patterns/consistent-hashing/' },
                { text: 'Trie (Prefix Tree)', link: '/patterns/trie/' },
                { text: 'Skip List', link: '/patterns/skip-list/' },
                { text: 'Rate Limiter', link: '/patterns/rate-limiter/' },
                { text: 'Work Stealing', link: '/patterns/work-stealing/' },
                { text: 'MVCC', link: '/patterns/mvcc/' },
                { text: 'Free List', link: '/patterns/free-list/' },
                { text: 'Dependency Graph', link: '/patterns/dependency-graph/' },
                { text: 'Actor Model', link: '/patterns/actor-model/' },
                { text: 'Reference Counting', link: '/patterns/reference-counting/' },
                { text: 'Logical Clock', link: '/patterns/logical-clock/' },
                { text: 'Event Loop', link: '/patterns/event-loop/' },
                { text: 'Middleware Chain', link: '/patterns/middleware-chain/' },
              ],
            },
          ],
          '/by-project/': [
            {
              text: 'By Source Project',
              items: [
                { text: 'React', link: '/by-project/react' },
                { text: 'Linux Kernel', link: '/by-project/linux' },
                { text: 'Go', link: '/by-project/go-runtime' },
                { text: 'Git', link: '/by-project/git' },
                { text: 'Node.js Ecosystem', link: '/by-project/nodejs' },
                { text: 'Rust', link: '/by-project/rust' },
                { text: 'Game Engines', link: '/by-project/game-engines' },
                { text: 'Distributed Systems', link: '/by-project/distributed-systems' },
                { text: 'More Projects', link: '/by-project/more-projects' },
              ],
            },
          ],
        },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/what-is-this' },
          { text: '模式', link: '/zh/patterns/bitmask/' },
          { text: '按项目', link: '/zh/by-project/react' },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '入门',
              items: [
                { text: '这是什么？', link: '/zh/guide/what-is-this' },
                { text: '模式如何协作', link: '/zh/guide/pattern-connections' },
                { text: '如何贡献', link: '/zh/guide/how-to-contribute' },
              ],
            },
          ],
          '/zh/patterns/': [
            {
              text: '编程模式',
              items: [
                { text: '位掩码 (Bitmask)', link: '/zh/patterns/bitmask/' },
                { text: '双缓冲 (Double Buffering)', link: '/zh/patterns/double-buffering/' },
                { text: '协作调度 (Cooperative Scheduling)', link: '/zh/patterns/cooperative-scheduling/' },
                { text: '最小堆 (Min Heap)', link: '/zh/patterns/min-heap/' },
                { text: '差异/补丁 (Diff/Patch)', link: '/zh/patterns/diff-patch/' },
                { text: '对象池 (Object Pool)', link: '/zh/patterns/object-pool/' },
                { text: '环形缓冲区 (Ring Buffer)', link: '/zh/patterns/ring-buffer/' },
                { text: '状态机 (State Machine)', link: '/zh/patterns/state-machine/' },
                { text: '写时复制 (Copy-on-Write)', link: '/zh/patterns/copy-on-write/' },
                { text: '观察者 (Observer)', link: '/zh/patterns/observer/' },
                { text: '迭代器 (Iterator)', link: '/zh/patterns/iterator/' },
                { text: '信号量 (Semaphore)', link: '/zh/patterns/semaphore/' },
                { text: '批处理 (Batch Processing)', link: '/zh/patterns/batch-processing/' },
                { text: '指数退避重试 (Retry)', link: '/zh/patterns/retry-backoff/' },
                { text: '享元/驻留 (Flyweight)', link: '/zh/patterns/flyweight/' },
                { text: '布隆过滤器 (Bloom Filter)', link: '/zh/patterns/bloom-filter/' },
                { text: '熔断器 (Circuit Breaker)', link: '/zh/patterns/circuit-breaker/' },
                { text: 'Arena 分配器', link: '/zh/patterns/arena-allocator/' },
                { text: '背压 (Backpressure)', link: '/zh/patterns/backpressure/' },
                { text: '预写日志 (WAL)', link: '/zh/patterns/write-ahead-log/' },
                { text: 'LRU 缓存', link: '/zh/patterns/lru-cache/' },
                { text: '一致性哈希', link: '/zh/patterns/consistent-hashing/' },
                { text: 'Trie 前缀树', link: '/zh/patterns/trie/' },
                { text: '跳表 (Skip List)', link: '/zh/patterns/skip-list/' },
                { text: '限流器 (Rate Limiter)', link: '/zh/patterns/rate-limiter/' },
                { text: '工作窃取 (Work Stealing)', link: '/zh/patterns/work-stealing/' },
                { text: 'MVCC 多版本并发控制', link: '/zh/patterns/mvcc/' },
                { text: '空闲链表 (Free List)', link: '/zh/patterns/free-list/' },
                { text: '依赖图 (Dependency Graph)', link: '/zh/patterns/dependency-graph/' },
                { text: 'Actor 模型', link: '/zh/patterns/actor-model/' },
                { text: '引用计数 (Reference Counting)', link: '/zh/patterns/reference-counting/' },
                { text: '逻辑时钟 (Logical Clock)', link: '/zh/patterns/logical-clock/' },
                { text: '事件循环 (Event Loop)', link: '/zh/patterns/event-loop/' },
                { text: '中间件链 (Middleware Chain)', link: '/zh/patterns/middleware-chain/' },
              ],
            },
          ],
          '/zh/by-project/': [
            {
              text: '按来源项目',
              items: [
                { text: 'React', link: '/zh/by-project/react' },
                { text: 'Linux 内核', link: '/zh/by-project/linux' },
                { text: 'Go', link: '/zh/by-project/go-runtime' },
                { text: 'Git', link: '/zh/by-project/git' },
                { text: 'Node.js 生态', link: '/zh/by-project/nodejs' },
                { text: 'Rust', link: '/zh/by-project/rust' },
                { text: '游戏引擎', link: '/zh/by-project/game-engines' },
                { text: '分布式系统', link: '/zh/by-project/distributed-systems' },
                { text: '更多项目', link: '/zh/by-project/more-projects' },
              ],
            },
          ],
        },
      },
    },
  },

  themeConfig: {
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

  mermaid: {},
}));
