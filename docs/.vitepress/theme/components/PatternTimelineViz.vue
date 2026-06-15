<script setup lang="ts">
import { ref, computed } from 'vue';
import { withBase } from 'vitepress';
import { useI18n } from '../composables/useI18n';

const { t, isZh } = useI18n();

type Category = 'data' | 'concurrency' | 'system' | 'memory' | 'behavioral';

interface TimelineEntry {
  year: number;
  approx: boolean;
  name: string;
  nameZh: string;
  origin: string;
  originZh: string;
  category: Category;
  link: string;
}

const categoryMeta: Record<Category, { label: string; labelZh: string; color: string }> = {
  data: { label: 'Data Structures', labelZh: '数据结构', color: '#10b981' },
  concurrency: { label: 'Concurrency', labelZh: '并发', color: '#3b82f6' },
  system: { label: 'System', labelZh: '系统', color: '#8b5cf6' },
  memory: { label: 'Memory', labelZh: '内存', color: '#f59e0b' },
  behavioral: { label: 'Behavioral', labelZh: '行为', color: '#ef4444' },
};

const entries: TimelineEntry[] = [
  {
    year: 1943,
    approx: true,
    name: 'State Machine',
    nameZh: '状态机',
    category: 'behavioral',
    link: '/patterns/state-machine/',
    origin: 'McCulloch & Pitts — neurons as finite automata',
    originZh: 'McCulloch & Pitts — 神经元建模为有限自动机',
  },
  {
    year: 1945,
    approx: true,
    name: 'Bitmask',
    nameZh: '位掩码',
    category: 'data',
    link: '/patterns/bitmask/',
    origin: "von Neumann's EDVAC — bit-level operations",
    originZh: 'von Neumann EDVAC — 位级操作',
  },
  {
    year: 1953,
    approx: true,
    name: 'Double Buffering',
    nameZh: '双缓冲',
    category: 'concurrency',
    link: '/patterns/double-buffering/',
    origin: 'IBM 701/709 I/O subsystems',
    originZh: 'IBM 701/709 I/O 子系统',
  },
  {
    year: 1956,
    approx: true,
    name: 'Batch Processing',
    nameZh: '批处理',
    category: 'system',
    link: '/patterns/batch-processing/',
    origin: 'GM-NAA I/O monitor for IBM 704',
    originZh: 'GM-NAA I/O 监控器（IBM 704）',
  },
  {
    year: 1958,
    approx: false,
    name: 'Free List',
    nameZh: '空闲链表',
    category: 'memory',
    link: '/patterns/free-list/',
    origin: "McCarthy's LISP — cons cell allocation",
    originZh: 'McCarthy LISP — cons cell 分配',
  },
  {
    year: 1958,
    approx: false,
    name: 'Cooperative Scheduling',
    nameZh: '协作调度',
    category: 'concurrency',
    link: '/patterns/cooperative-scheduling/',
    origin: 'Conway coroutines (published 1963)',
    originZh: 'Conway 协程（1963 年发表）',
  },
  {
    year: 1959,
    approx: false,
    name: 'Trie',
    nameZh: 'Trie 前缀树',
    category: 'data',
    link: '/patterns/trie/',
    origin: 'de la Briandais; Fredkin coined "trie" (1960)',
    originZh: 'de la Briandais；Fredkin 命名"trie"（1960）',
  },
  {
    year: 1960,
    approx: true,
    name: 'Ring Buffer',
    nameZh: '环形缓冲区',
    category: 'data',
    link: '/patterns/ring-buffer/',
    origin: 'Telecom and real-time I/O systems',
    originZh: '电信和实时 I/O 系统',
  },
  {
    year: 1960,
    approx: true,
    name: 'Arena Allocator',
    nameZh: 'Arena 分配器',
    category: 'memory',
    link: '/patterns/arena-allocator/',
    origin: 'Region-based allocation in compilers',
    originZh: '编译器中的区域分配',
  },
  {
    year: 1960,
    approx: false,
    name: 'Reference Counting',
    nameZh: '引用计数',
    category: 'memory',
    link: '/patterns/reference-counting/',
    origin: 'George Collins — automatic storage reclamation',
    originZh: 'George Collins — 自动存储回收',
  },
  {
    year: 1960,
    approx: true,
    name: 'Interning',
    nameZh: '驻留',
    category: 'memory',
    link: '/patterns/interning/',
    origin: 'LISP symbol interning',
    originZh: 'LISP 符号驻留',
  },
  {
    year: 1962,
    approx: false,
    name: 'Dependency Graph',
    nameZh: '依赖图',
    category: 'system',
    link: '/patterns/dependency-graph/',
    origin: "Kahn's topological sorting (CACM)",
    originZh: 'Kahn 拓扑排序（CACM）',
  },
  {
    year: 1964,
    approx: false,
    name: 'Min Heap',
    nameZh: '最小堆',
    category: 'data',
    link: '/patterns/min-heap/',
    origin: 'Williams — binary heap for heapsort',
    originZh: 'Williams — 堆排序的二叉堆',
  },
  {
    year: 1965,
    approx: false,
    name: 'Semaphore',
    nameZh: '信号量',
    category: 'concurrency',
    link: '/patterns/semaphore/',
    origin: 'Dijkstra — P() and V() for THE OS',
    originZh: 'Dijkstra — THE 操作系统的 P() 和 V()',
  },
  {
    year: 1965,
    approx: true,
    name: 'Dirty Flag',
    nameZh: '脏标记',
    category: 'system',
    link: '/patterns/dirty-flag/',
    origin: 'Virtual memory dirty bits',
    originZh: '虚拟内存脏位',
  },
  {
    year: 1966,
    approx: false,
    name: 'LRU Cache',
    nameZh: 'LRU 缓存',
    category: 'data',
    link: '/patterns/lru-cache/',
    origin: 'Belady — replacement algorithm study',
    originZh: 'Belady — 替换算法研究',
  },
  {
    year: 1966,
    approx: true,
    name: 'Tagged Union',
    nameZh: '标签联合',
    category: 'data',
    link: '/patterns/tagged-union/',
    origin: 'Algol 68 discriminated unions',
    originZh: 'Algol 68 判别联合体',
  },
  {
    year: 1967,
    approx: false,
    name: 'Vtable',
    nameZh: '虚函数表',
    category: 'behavioral',
    link: '/patterns/vtable/',
    origin: 'Simula 67 virtual method dispatch',
    originZh: 'Simula 67 虚方法分派',
  },
  {
    year: 1967,
    approx: true,
    name: 'Event Loop',
    nameZh: '事件循环',
    category: 'concurrency',
    link: '/patterns/event-loop/',
    origin: 'Early interactive systems',
    originZh: '早期交互系统',
  },
  {
    year: 1970,
    approx: false,
    name: 'Bloom Filter',
    nameZh: '布隆过滤器',
    category: 'data',
    link: '/patterns/bloom-filter/',
    origin: 'Burton Bloom (CACM)',
    originZh: 'Burton Bloom（CACM）',
  },
  {
    year: 1970,
    approx: true,
    name: 'B+ Tree',
    nameZh: 'B+ 树',
    category: 'data',
    link: '/patterns/b-plus-tree/',
    origin: 'Bayer & McCreight',
    originZh: 'Bayer & McCreight',
  },
  {
    year: 1971,
    approx: true,
    name: 'Copy-on-Write',
    nameZh: '写时复制',
    category: 'memory',
    link: '/patterns/copy-on-write/',
    origin: 'IBM VM/370 virtual memory',
    originZh: 'IBM VM/370 虚拟内存',
  },
  {
    year: 1973,
    approx: false,
    name: 'Actor Model',
    nameZh: 'Actor 模型',
    category: 'concurrency',
    link: '/patterns/actor-model/',
    origin: 'Hewitt, Bishop, Steiger',
    originZh: 'Hewitt, Bishop, Steiger',
  },
  {
    year: 1973,
    approx: false,
    name: 'Retry with Backoff',
    nameZh: '指数退避重试',
    category: 'system',
    link: '/patterns/retry-backoff/',
    origin: "Metcalfe's Ethernet CSMA/CD",
    originZh: 'Metcalfe 以太网 CSMA/CD',
  },
  {
    year: 1974,
    approx: false,
    name: 'Diff / Patch',
    nameZh: '差异/补丁',
    category: 'behavioral',
    link: '/patterns/diff-patch/',
    origin: 'McIlroy — diff for Unix V5',
    originZh: 'McIlroy — Unix V5 的 diff',
  },
  {
    year: 1974,
    approx: true,
    name: 'Backpressure',
    nameZh: '背压',
    category: 'concurrency',
    link: '/patterns/backpressure/',
    origin: 'TCP flow control (Cerf & Kahn)',
    originZh: 'TCP 流控（Cerf & Kahn）',
  },
  {
    year: 1975,
    approx: false,
    name: 'Iterator',
    nameZh: '迭代器',
    category: 'behavioral',
    link: '/patterns/iterator/',
    origin: "Liskov's CLU language",
    originZh: 'Liskov CLU 语言',
  },
  {
    year: 1975,
    approx: true,
    name: 'Tombstone',
    nameZh: '墓碑',
    category: 'memory',
    link: '/patterns/tombstone/',
    origin: 'Database delete markers',
    originZh: '数据库删除标记',
  },
  {
    year: 1976,
    approx: true,
    name: 'Write-Ahead Log',
    nameZh: '预写日志',
    category: 'system',
    link: '/patterns/write-ahead-log/',
    origin: 'IBM System R',
    originZh: 'IBM System R',
  },
  {
    year: 1976,
    approx: true,
    name: 'Checkpointing',
    nameZh: '检查点',
    category: 'system',
    link: '/patterns/checkpointing/',
    origin: 'System R crash recovery',
    originZh: 'System R 崩溃恢复',
  },
  {
    year: 1978,
    approx: false,
    name: 'MVCC',
    nameZh: 'MVCC',
    category: 'concurrency',
    link: '/patterns/mvcc/',
    origin: "David Reed's MIT PhD",
    originZh: 'David Reed MIT 博士论文',
  },
  {
    year: 1978,
    approx: false,
    name: 'Logical Clock',
    nameZh: '逻辑时钟',
    category: 'concurrency',
    link: '/patterns/logical-clock/',
    origin: 'Lamport timestamps',
    originZh: 'Lamport 时间戳',
  },
  {
    year: 1979,
    approx: false,
    name: 'Observer / Pub-Sub',
    nameZh: '观察者',
    category: 'behavioral',
    link: '/patterns/observer/',
    origin: "Reenskaug's MVC at Xerox PARC",
    originZh: 'Reenskaug 在 Xerox PARC 的 MVC',
  },
  {
    year: 1979,
    approx: false,
    name: 'Merkle Tree',
    nameZh: '默克尔树',
    category: 'data',
    link: '/patterns/merkle-tree/',
    origin: 'Ralph Merkle — hash tree patent',
    originZh: 'Ralph Merkle — 哈希树专利',
  },
  {
    year: 1981,
    approx: false,
    name: 'Work Stealing',
    nameZh: '工作窃取',
    category: 'concurrency',
    link: '/patterns/work-stealing/',
    origin: 'Burton & Sleep — parallel graph reduction',
    originZh: 'Burton & Sleep — 并行图归约',
  },
  {
    year: 1986,
    approx: true,
    name: 'Rate Limiter',
    nameZh: '限流器',
    category: 'system',
    link: '/patterns/rate-limiter/',
    origin: 'Turner — leaky bucket for traffic shaping',
    originZh: 'Turner — 漏桶算法',
  },
  {
    year: 1989,
    approx: false,
    name: 'Skip List',
    nameZh: '跳表',
    category: 'data',
    link: '/patterns/skip-list/',
    origin: 'Pugh (CACM)',
    originZh: 'Pugh（CACM）',
  },
  {
    year: 1990,
    approx: false,
    name: 'Flyweight',
    nameZh: '享元',
    category: 'memory',
    link: '/patterns/flyweight/',
    origin: 'Calder & Linton (USENIX)',
    originZh: 'Calder & Linton（USENIX）',
  },
  {
    year: 1993,
    approx: true,
    name: 'Middleware Chain',
    nameZh: '中间件链',
    category: 'system',
    link: '/patterns/middleware-chain/',
    origin: 'CORBA / web frameworks',
    originZh: 'CORBA / Web 框架',
  },
  {
    year: 1993,
    approx: true,
    name: 'Registry',
    nameZh: '注册表',
    category: 'system',
    link: '/patterns/registry/',
    origin: 'COM / CORBA component discovery',
    originZh: 'COM / CORBA 组件发现',
  },
  {
    year: 1994,
    approx: true,
    name: 'Object Pool',
    nameZh: '对象池',
    category: 'memory',
    link: '/patterns/object-pool/',
    origin: "Bonwick's slab allocator (Solaris)",
    originZh: 'Bonwick Solaris slab 分配器',
  },
  {
    year: 1994,
    approx: false,
    name: 'Visitor',
    nameZh: '访问者',
    category: 'behavioral',
    link: '/patterns/visitor/',
    origin: 'GoF Design Patterns',
    originZh: 'GoF《设计模式》',
  },
  {
    year: 1996,
    approx: false,
    name: 'LSM Tree',
    nameZh: 'LSM 树',
    category: 'system',
    link: '/patterns/lsm-tree/',
    origin: "O'Neil et al.",
    originZh: "O'Neil 等人",
  },
  {
    year: 1997,
    approx: false,
    name: 'Consistent Hashing',
    nameZh: '一致性哈希',
    category: 'system',
    link: '/patterns/consistent-hashing/',
    origin: 'Karger et al. (STOC)',
    originZh: 'Karger 等人（STOC）',
  },
  {
    year: 2003,
    approx: true,
    name: 'Merge Iterator',
    nameZh: '归并迭代器',
    category: 'data',
    link: '/patterns/merge-iterator/',
    origin: 'LevelDB / BigTable K-way merge',
    originZh: 'LevelDB / BigTable K 路合并',
  },
  {
    year: 2007,
    approx: false,
    name: 'Circuit Breaker',
    nameZh: '熔断器',
    category: 'system',
    link: '/patterns/circuit-breaker/',
    origin: 'Nygard — Release It!',
    originZh: 'Nygard《Release It!》',
  },
];

const activeCategory = ref<Category | 'all'>('all');

const filteredEntries = computed(() => {
  if (activeCategory.value === 'all') return entries;
  return entries.filter((e) => e.category === activeCategory.value);
});

const decades = computed(() => {
  const map = new Map<number, TimelineEntry[]>();
  for (const e of filteredEntries.value) {
    const decade = Math.floor(e.year / 10) * 10;
    if (!map.has(decade)) map.set(decade, []);
    map.get(decade)!.push(e);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
});

const stats = computed(() => ({
  total: entries.length,
  span: entries[entries.length - 1].year - entries[0].year,
  categories: Object.keys(categoryMeta).length,
}));

function linkFor(entry: TimelineEntry) {
  const path = isZh.value ? `/zh${entry.link}` : entry.link;
  return withBase(path);
}
</script>

<template>
  <div class="viz-container tl-container">
    <div class="viz-title">{{ t('Interactive Pattern Timeline', '交互式模式时间线') }}</div>

    <div class="tl-stats">
      <div class="tl-stat">
        <span class="tl-stat-value">{{ stats.total }}</span>
        <span class="viz-label">{{ t('Patterns', '模式') }}</span>
      </div>
      <div class="tl-stat">
        <span class="tl-stat-value">{{ stats.span }}+</span>
        <span class="viz-label">{{ t('Years', '年') }}</span>
      </div>
      <div class="tl-stat">
        <span class="tl-stat-value">{{ stats.categories }}</span>
        <span class="viz-label">{{ t('Categories', '类别') }}</span>
      </div>
    </div>

    <!-- Category filter -->
    <div class="tl-filters">
      <button
        class="tl-filter"
        :class="{ 'tl-filter--active': activeCategory === 'all' }"
        @click="activeCategory = 'all'"
      >
        {{ t('All', '全部') }} ({{ entries.length }})
      </button>
      <button
        v-for="(meta, key) in categoryMeta"
        :key="key"
        class="tl-filter"
        :class="{ 'tl-filter--active': activeCategory === key }"
        :style="
          activeCategory === key
            ? { background: meta.color, borderColor: meta.color, color: '#fff' }
            : { borderColor: meta.color, color: meta.color }
        "
        @click="activeCategory = activeCategory === key ? 'all' : (key as Category)"
      >
        {{ isZh ? meta.labelZh : meta.label }} ({{
          entries.filter((e) => e.category === key).length
        }})
      </button>
    </div>

    <div class="viz-status" aria-live="polite">
      {{
        t('Click any pattern card to view its full documentation', '点击任意模式卡片查看完整文档')
      }}
    </div>

    <!-- Timeline -->
    <div class="tl-timeline">
      <div class="tl-line"></div>

      <div v-for="[decade, items] in decades" :key="decade" class="tl-decade">
        <div class="tl-decade-label">{{ decade }}s</div>

        <div
          v-for="(entry, i) in items"
          :key="entry.name"
          class="tl-entry"
          :class="i % 2 === 0 ? 'tl-entry--left' : 'tl-entry--right'"
        >
          <div class="tl-node" :style="{ background: categoryMeta[entry.category].color }"></div>
          <a :href="linkFor(entry)" class="tl-card">
            <div class="tl-card-header">
              <span class="tl-year">{{ entry.approx ? '~' : '' }}{{ entry.year }}</span>
              <span
                class="tl-cat-dot"
                :style="{ background: categoryMeta[entry.category].color }"
              ></span>
            </div>
            <div class="tl-card-name">{{ isZh ? entry.nameZh : entry.name }}</div>
            <div class="tl-card-origin">{{ isZh ? entry.originZh : entry.origin }}</div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl-container {
  max-width: 720px;
  margin: 0 auto;
}

.tl-stats {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.tl-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.tl-stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.tl-filters {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.tl-filter {
  padding: 0.25rem 0.625rem;
  border: 1.5px solid var(--viz-border);
  border-radius: 999px;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--viz-transition);
  font-family: var(--vp-font-family-base);
  color: var(--viz-muted);
}

.tl-filter:hover {
  opacity: 0.85;
}

.tl-filter--active {
  background: var(--viz-primary) !important;
  border-color: var(--viz-primary) !important;
  color: #fff !important;
}

/* Timeline structure */
.tl-timeline {
  position: relative;
  padding: 0 0 1rem;
}

.tl-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--viz-border);
  transform: translateX(-50%);
}

.tl-decade {
  position: relative;
  margin-bottom: 0.5rem;
}

.tl-decade-label {
  position: relative;
  z-index: 2;
  display: inline-block;
  left: 50%;
  transform: translateX(-50%);
  background: var(--vp-c-bg);
  border: 2px solid var(--viz-border);
  border-radius: 999px;
  padding: 0.125rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 800;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  margin-bottom: 0.5rem;
}

.tl-entry {
  position: relative;
  display: flex;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  min-height: 36px;
}

.tl-entry--left {
  flex-direction: row-reverse;
}

.tl-entry--left .tl-card {
  margin-right: calc(50% + 14px);
  margin-left: 0;
  text-align: right;
}

.tl-entry--right .tl-card {
  margin-left: calc(50% + 14px);
  margin-right: 0;
  text-align: left;
}

.tl-node {
  position: absolute;
  left: 50%;
  top: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translateX(-50%);
  z-index: 2;
  border: 2px solid var(--vp-c-bg);
  box-shadow: 0 0 0 2px var(--viz-border);
  transition: transform var(--viz-transition);
}

.tl-entry:hover .tl-node {
  transform: translateX(-50%) scale(1.4);
}

.tl-card {
  display: block;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  text-decoration: none;
  transition: all var(--viz-transition);
  max-width: calc(50% - 20px);
  box-sizing: border-box;
}

.tl-card:hover {
  border-color: var(--viz-primary);
  box-shadow: var(--viz-shadow-md);
  transform: translateY(-1px);
}

.tl-card-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.125rem;
}

.tl-entry--left .tl-card-header {
  flex-direction: row-reverse;
}

.tl-year {
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.tl-cat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tl-card-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--viz-text);
  line-height: 1.3;
}

.tl-card-origin {
  font-size: 0.6875rem;
  color: var(--viz-muted);
  line-height: 1.35;
  margin-top: 0.125rem;
}

@media (width <= 640px) {
  .tl-line {
    left: 16px;
  }

  .tl-decade-label {
    left: 16px;
    transform: none;
  }

  .tl-entry,
  .tl-entry--left {
    flex-direction: row;
  }

  .tl-node {
    left: 16px;
  }

  .tl-entry--left .tl-card,
  .tl-entry--right .tl-card {
    margin-left: 38px;
    margin-right: 0;
    text-align: left;
    max-width: calc(100% - 44px);
  }

  .tl-entry--left .tl-card-header {
    flex-direction: row;
  }
}
</style>
