<script setup lang="ts">
import { ref, computed } from 'vue';
import { withBase } from 'vitepress';
import { useI18n } from '../composables/useI18n';

const { t, isZh } = useI18n();

interface PatternUsage {
  pattern: string;
  patternZh: string;
  link: string;
  where: string;
  whereZh: string;
  why: string;
  whyZh: string;
}

interface SystemEntry {
  id: string;
  name: string;
  nameZh: string;
  icon: string;
  color: string;
  desc: string;
  descZh: string;
  patterns: PatternUsage[];
}

const systems: SystemEntry[] = [
  {
    id: 'react',
    name: 'React',
    nameZh: 'React',
    icon: '⚛',
    color: '#61dafb',
    desc: 'Five patterns compose into one render cycle',
    descZh: '五个模式组合成一次渲染周期',
    patterns: [
      {
        pattern: 'Min Heap',
        patternZh: '最小堆',
        link: '/patterns/min-heap/',
        where: 'Scheduler picks highest-priority task',
        whereZh: '调度器选择最高优先级任务',
        why: 'O(1) extract-min for expiration-sorted updates',
        whyZh: 'O(1) 提取过期时间最早的更新',
      },
      {
        pattern: 'Cooperative Scheduling',
        patternZh: '协作调度',
        link: '/patterns/cooperative-scheduling/',
        where: 'workLoopConcurrent yields every 5ms',
        whereZh: 'workLoopConcurrent 每 5ms 让出',
        why: 'Keeps UI responsive during long renders',
        whyZh: '在长渲染期间保持 UI 响应',
      },
      {
        pattern: 'Diff / Patch',
        patternZh: '差异/补丁',
        link: '/patterns/diff-patch/',
        where: 'reconcileChildFibers compares trees',
        whereZh: 'reconcileChildFibers 对比新旧树',
        why: 'Minimizes DOM mutations',
        whyZh: '最小化 DOM 变更',
      },
      {
        pattern: 'Bitmask',
        patternZh: '位掩码',
        link: '/patterns/bitmask/',
        where: 'Fiber flags: Placement | Update | Ref',
        whereZh: 'Fiber 标志：Placement | Update | Ref',
        why: 'Track effects in a single integer, bubble up via OR',
        whyZh: '用单个整数追踪副作用，通过 OR 向上冒泡',
      },
      {
        pattern: 'Double Buffering',
        patternZh: '双缓冲',
        link: '/patterns/double-buffering/',
        where: 'current ↔ workInProgress tree swap',
        whereZh: 'current ↔ workInProgress 树交换',
        why: 'Atomic commit — users never see partial renders',
        whyZh: '原子提交——用户永远看不到部分渲染',
      },
    ],
  },
  {
    id: 'redis',
    name: 'Redis',
    nameZh: 'Redis',
    icon: '🗄',
    color: '#dc382d',
    desc: 'Speed through data structure composition',
    descZh: '通过数据结构组合实现极致速度',
    patterns: [
      {
        pattern: 'Skip List',
        patternZh: '跳表',
        link: '/patterns/skip-list/',
        where: 'Sorted sets (zset) — t_zset.c',
        whereZh: '有序集合（zset）— t_zset.c',
        why: 'O(log N) insert + range queries, simpler than balanced trees',
        whyZh: 'O(log N) 插入 + 范围查询，比平衡树简单',
      },
      {
        pattern: 'LRU Cache',
        patternZh: 'LRU 缓存',
        link: '/patterns/lru-cache/',
        where: 'maxmemory-policy — evict.c',
        whereZh: 'maxmemory-policy — evict.c',
        why: 'Approximate LRU via random sampling of 5 keys',
        whyZh: '通过随机采样 5 个键近似 LRU',
      },
      {
        pattern: 'Trie (RAX)',
        patternZh: 'Trie (RAX)',
        link: '/patterns/trie/',
        where: 'Cluster slot routing — rax.c',
        whereZh: '集群键槽路由 — rax.c',
        why: 'Memory-efficient prefix lookups for routing',
        whyZh: '内存高效的前缀查找用于路由',
      },
      {
        pattern: 'Checkpointing',
        patternZh: '检查点',
        link: '/patterns/checkpointing/',
        where: 'rdb.c — fork + serialize dataset to RDB file',
        whereZh: 'rdb.c — fork 子进程序列化数据集到 RDB 文件',
        why: 'Point-in-time snapshot for crash recovery without blocking',
        whyZh: '无阻塞的时间点快照用于崩溃恢复',
      },
      {
        pattern: 'Batch Processing',
        patternZh: '批处理',
        link: '/patterns/batch-processing/',
        where: 'PIPELINE, MULTI/EXEC',
        whereZh: 'PIPELINE、MULTI/EXEC',
        why: 'Batch N commands into one network round-trip',
        whyZh: '将 N 条命令批量打包为一次网络往返',
      },
    ],
  },
  {
    id: 'go',
    name: 'Go Runtime',
    nameZh: 'Go 运行时',
    icon: '🐹',
    color: '#00add8',
    desc: 'Scheduling and memory at scale',
    descZh: '大规模调度与内存管理',
    patterns: [
      {
        pattern: 'Work Stealing',
        patternZh: '工作窃取',
        link: '/patterns/work-stealing/',
        where: 'proc.go:findRunnable() — idle P steals',
        whereZh: 'proc.go:findRunnable() — 空闲 P 偷取',
        why: 'Balance goroutines across threads without global lock',
        whyZh: '无需全局锁即可均衡 goroutine 调度',
      },
      {
        pattern: 'Free List',
        patternZh: '空闲链表',
        link: '/patterns/free-list/',
        where: 'mcache.go — per-P free lists by size class',
        whereZh: 'mcache.go — 按大小类别的 per-P 空闲链表',
        why: 'O(1) small object allocation, no contention',
        whyZh: 'O(1) 小对象分配，无竞争',
      },
      {
        pattern: 'Semaphore',
        patternZh: '信号量',
        link: '/patterns/semaphore/',
        where: 'sema.go — sync.Mutex, sync.WaitGroup',
        whereZh: 'sema.go — sync.Mutex、sync.WaitGroup',
        why: 'Counting semaphore with treap-based wait queue',
        whyZh: '带 treap 等待队列的计数信号量',
      },
      {
        pattern: 'Cooperative Scheduling',
        patternZh: '协作调度',
        link: '/patterns/cooperative-scheduling/',
        where: 'proc.go:goschedImpl — yield at prologues',
        whereZh: 'proc.go:goschedImpl — 函数序言处让出',
        why: 'Combined with async preemption since Go 1.14',
        whyZh: '自 Go 1.14 起结合异步抢占',
      },
      {
        pattern: 'Object Pool',
        patternZh: '对象池',
        link: '/patterns/object-pool/',
        where: 'sync.Pool — per-P private + shared pools',
        whereZh: 'sync.Pool — per-P 私有池 + 共享池',
        why: 'Amortize allocation cost, cleared every 2 GC cycles',
        whyZh: '摊薄分配成本，每两个 GC 周期清理',
      },
      {
        pattern: 'Min Heap',
        patternZh: '最小堆',
        link: '/patterns/min-heap/',
        where: 'time.go — per-P timer heaps',
        whereZh: 'time.go — per-P 定时器堆',
        why: 'Per-P heaps reduce lock contention vs global heap',
        whyZh: 'per-P 堆减少锁竞争',
      },
    ],
  },
  {
    id: 'linux',
    name: 'Linux Kernel',
    nameZh: 'Linux 内核',
    icon: '🐧',
    color: '#f5c542',
    desc: '30+ years of optimization across subsystems',
    descZh: '30 多年跨子系统的优化积累',
    patterns: [
      {
        pattern: 'Bitmask',
        patternZh: '位掩码',
        link: '/patterns/bitmask/',
        where: 'File permissions, capability flags, GFP_*',
        whereZh: '文件权限、能力标志、GFP_*',
        why: 'Encode multiple booleans in a single integer',
        whyZh: '用单个整数编码多个布尔状态',
      },
      {
        pattern: 'Min Heap',
        patternZh: '最小堆',
        link: '/patterns/min-heap/',
        where: 'lib/min_heap.h — perf_event, hrtimer',
        whereZh: 'lib/min_heap.h — perf_event、hrtimer',
        why: 'Generic min heap since kernel 5.8',
        whyZh: '自内核 5.8 起的通用最小堆',
      },
      {
        pattern: 'Ring Buffer',
        patternZh: '环形缓冲区',
        link: '/patterns/ring-buffer/',
        where: 'io_uring, perf event buffer, ftrace',
        whereZh: 'io_uring、perf 事件缓冲区、ftrace',
        why: 'Zero-copy, lockless kernel↔userspace data passing',
        whyZh: '零拷贝、无锁的内核↔用户空间数据传递',
      },
      {
        pattern: 'State Machine',
        patternZh: '状态机',
        link: '/patterns/state-machine/',
        where: 'Process states, TCP states, device power',
        whereZh: '进程状态、TCP 状态、设备电源',
        why: 'Every kernel lifecycle is an explicit state machine',
        whyZh: '内核中每个生命周期都是显式状态机',
      },
      {
        pattern: 'Free List',
        patternZh: '空闲链表',
        link: '/patterns/free-list/',
        where: 'SLAB/SLUB — per-CPU free lists',
        whereZh: 'SLAB/SLUB — per-CPU 空闲链表',
        why: 'O(1) kernel object allocation without lock contention',
        whyZh: 'O(1) 内核对象分配，无锁竞争',
      },
      {
        pattern: 'Trie',
        patternZh: 'Trie 前缀树',
        link: '/patterns/trie/',
        where: 'fib_trie.c — LC-trie for IPv4 routing',
        whereZh: 'fib_trie.c — IPv4 路由的 LC-trie',
        why: 'Longest-prefix match in O(W), handles millions of routes',
        whyZh: 'O(W) 最长前缀匹配，处理数百万条路由',
      },
      {
        pattern: 'Backpressure',
        patternZh: '背压',
        link: '/patterns/backpressure/',
        where: 'TCP window, cgroups, SO_RCVBUF',
        whereZh: 'TCP 窗口、cgroups、SO_RCVBUF',
        why: 'Prevent fast producers from overwhelming slow consumers',
        whyZh: '防止快速生产者压垮慢速消费者',
      },
      {
        pattern: 'Semaphore',
        patternZh: '信号量',
        link: '/patterns/semaphore/',
        where: 'rw_semaphore for VFS inode locking',
        whereZh: 'rw_semaphore 用于 VFS inode 锁',
        why: 'Concurrent reads, serialized writes',
        whyZh: '并发读取，序列化写入',
      },
    ],
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    nameZh: 'PostgreSQL',
    icon: '🐘',
    color: '#336791',
    desc: 'ACID through pattern composition',
    descZh: '通过模式组合实现 ACID',
    patterns: [
      {
        pattern: 'MVCC',
        patternZh: 'MVCC',
        link: '/patterns/mvcc/',
        where: 'heapam.c — xmin/xmax per tuple',
        whereZh: 'heapam.c — 每元组 xmin/xmax',
        why: 'Readers never block writers — snapshot isolation',
        whyZh: '读不阻塞写——快照隔离',
      },
      {
        pattern: 'Write-Ahead Log',
        patternZh: '预写日志',
        link: '/patterns/write-ahead-log/',
        where: 'xlog.c — all changes logged before page modification',
        whereZh: 'xlog.c — 所有变更在页面修改前写入',
        why: 'Crash recovery + replication',
        whyZh: '崩溃恢复 + 复制',
      },
      {
        pattern: 'LRU Cache',
        patternZh: 'LRU 缓存',
        link: '/patterns/lru-cache/',
        where: 'bufmgr.c — shared_buffers with clock-sweep',
        whereZh: 'bufmgr.c — shared_buffers + clock-sweep',
        why: '8KB page cache with low-overhead eviction',
        whyZh: '低开销淘汰的 8KB 页缓存',
      },
      {
        pattern: 'Bloom Filter',
        patternZh: '布隆过滤器',
        link: '/patterns/bloom-filter/',
        where: 'contrib/bloom — bloom index access method',
        whereZh: 'contrib/bloom — bloom 索引访问方法',
        why: 'Multi-column equality filter via signature indexing',
        whyZh: '基于签名索引的多列等值过滤',
      },
    ],
  },
  {
    id: 'kafka',
    name: 'Kafka',
    nameZh: 'Kafka',
    icon: '📨',
    color: '#231f20',
    desc: 'Millions of messages/sec through batching and flow control',
    descZh: '通过批处理和流控实现百万消息/秒',
    patterns: [
      {
        pattern: 'Batch Processing',
        patternZh: '批处理',
        link: '/patterns/batch-processing/',
        where: 'RecordAccumulator — linger.ms + batch.size',
        whereZh: 'RecordAccumulator — linger.ms + batch.size',
        why: 'Amortize network overhead, thousands of records per request',
        whyZh: '摊薄网络开销，每请求携带数千条记录',
      },
      {
        pattern: 'Ring Buffer',
        patternZh: '环形缓冲区',
        link: '/patterns/ring-buffer/',
        where: 'OS page cache + zero-copy sendfile()',
        whereZh: 'OS 页缓存 + 零拷贝 sendfile()',
        why: 'Log-structured storage as append-only ring',
        whyZh: '日志结构存储本质上是仅追加的环',
      },
      {
        pattern: 'Backpressure',
        patternZh: '背压',
        link: '/patterns/backpressure/',
        where: 'Consumer pause()/resume() per partition',
        whereZh: 'Consumer 按分区 pause()/resume()',
        why: 'Prevent slow consumers from triggering rebalances',
        whyZh: '防止慢消费者触发再平衡',
      },
      {
        pattern: 'Retry Backoff',
        patternZh: '指数退避重试',
        link: '/patterns/retry-backoff/',
        where: 'Producer retries + retry.backoff.ms',
        whereZh: 'Producer retries + retry.backoff.ms',
        why: 'Exponential backoff + jitter avoids thundering herd',
        whyZh: '指数退避加抖动避免惊群',
      },
      {
        pattern: 'Consistent Hashing',
        patternZh: '一致性哈希',
        link: '/patterns/consistent-hashing/',
        where: 'DefaultPartitioner hashes keys to partitions',
        whereZh: 'DefaultPartitioner 将键哈希到分区',
        why: 'Key ordering within partition, minimal redistribution',
        whyZh: '分区内键有序，最小化重分布',
      },
    ],
  },
];

const activeSystem = ref('react');
const currentSystem = computed(() => systems.find((s) => s.id === activeSystem.value)!);

function patternLink(link: string) {
  const path = isZh.value ? `/zh${link}` : link;
  return withBase(path);
}
</script>

<template>
  <div class="viz-container pc-container">
    <div class="viz-title">{{ t('Pattern Composition Explorer', '模式组合探索器') }}</div>

    <div class="pc-tabs">
      <button
        v-for="sys in systems"
        :key="sys.id"
        class="pc-tab"
        :class="{ 'pc-tab--active': activeSystem === sys.id }"
        :style="activeSystem === sys.id ? { borderColor: sys.color, color: sys.color } : {}"
        @click="activeSystem = sys.id"
      >
        <span class="pc-tab-icon">{{ sys.icon }}</span>
        <span class="pc-tab-name">{{ isZh ? sys.nameZh : sys.name }}</span>
      </button>
    </div>

    <div class="viz-status" aria-live="polite">
      {{
        t(
          'Click a tab to explore how each system composes patterns',
          '点击标签查看每个系统如何组合模式',
        )
      }}
    </div>

    <div class="pc-system">
      <div class="pc-system-header">
        <span class="pc-system-icon" :style="{ background: currentSystem.color }">{{
          currentSystem.icon
        }}</span>
        <div>
          <div class="pc-system-name">{{ isZh ? currentSystem.nameZh : currentSystem.name }}</div>
          <div class="pc-system-desc">{{ isZh ? currentSystem.descZh : currentSystem.desc }}</div>
        </div>
        <span class="pc-pattern-count"
          >{{ currentSystem.patterns.length }} {{ t('patterns', '个模式') }}</span
        >
      </div>

      <div class="pc-patterns">
        <a
          v-for="(p, i) in currentSystem.patterns"
          :key="p.pattern"
          :href="patternLink(p.link)"
          class="pc-pattern"
          :style="{ '--delay': `${i * 50}ms`, borderLeftColor: currentSystem.color }"
        >
          <div class="pc-pattern-header">
            <span class="pc-pattern-name">{{ isZh ? p.patternZh : p.pattern }}</span>
            <span class="pc-pattern-arrow">→</span>
          </div>
          <div class="pc-pattern-where">{{ isZh ? p.whereZh : p.where }}</div>
          <div class="pc-pattern-why">{{ isZh ? p.whyZh : p.why }}</div>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pc-container {
  max-width: 720px;
  margin: 0 auto;
}

.pc-tabs {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1rem;
}

.pc-tab {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border: 1.5px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--viz-transition);
  color: var(--viz-muted);
  font-family: var(--vp-font-family-base);
}

.pc-tab:hover {
  border-color: var(--viz-text);
  color: var(--viz-text);
}

.pc-tab--active {
  background: var(--vp-c-bg);
  box-shadow: var(--viz-shadow-sm);
}

.pc-tab-icon {
  font-size: 1rem;
}

.pc-tab-name {
  font-family: var(--vp-font-family-mono);
}

.pc-system {
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-md);
  overflow: hidden;
  margin-bottom: 0.75rem;
  animation: pc-fadein 0.25s ease;
}

.pc-system-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--viz-border);
}

.pc-system-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--viz-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.pc-system-name {
  font-size: 1rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.pc-system-desc {
  font-size: 0.75rem;
  color: var(--viz-muted);
}

.pc-pattern-count {
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--viz-muted);
  white-space: nowrap;
}

.pc-patterns {
  display: flex;
  flex-direction: column;
}

.pc-pattern {
  display: block;
  padding: 0.625rem 1rem;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--viz-border);
  transition: background var(--viz-transition);
  animation: pc-slidein 0.3s ease both;
  animation-delay: var(--delay);
  text-decoration: none;
  color: inherit;
}

.pc-pattern:last-child {
  border-bottom: none;
}

.pc-pattern:hover {
  background: var(--vp-c-bg-soft);
}

.pc-pattern-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.pc-pattern-name {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.pc-pattern-arrow {
  font-size: 0.75rem;
  color: var(--viz-muted);
  opacity: 0;
  transition: opacity var(--viz-transition);
}

.pc-pattern:hover .pc-pattern-arrow {
  opacity: 1;
}

.pc-pattern-where {
  font-size: 0.6875rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-primary);
  margin-bottom: 0.125rem;
}

.pc-pattern-why {
  font-size: 0.6875rem;
  color: var(--viz-muted);
}

@keyframes pc-fadein {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes pc-slidein {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (width <= 640px) {
  .pc-tabs {
    gap: 0.25rem;
  }

  .pc-tab {
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
  }

  .pc-tab-icon {
    display: none;
  }

  .pc-system-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}
</style>
