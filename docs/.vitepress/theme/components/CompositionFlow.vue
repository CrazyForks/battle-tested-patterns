<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t, isZh } = useI18n();

const props = defineProps<{ variant: string }>();

interface Step {
  pattern: string;
  path: string;
  en: string;
  zh: string;
}

interface Flow {
  header: { en: string; zh: string };
  footer?: { en: string; zh: string };
  steps: Step[];
}

const flows: Record<string, Flow> = {
  'react-render': {
    header: { en: 'setState()', zh: 'setState()' },
    footer: { en: 'DOM updated (commit phase)', zh: 'DOM 更新（commit 阶段）' },
    steps: [
      { pattern: 'Min Heap', path: '/patterns/min-heap/', en: 'Scheduler inserts an update task with priority (lanes). The heap ensures the highest-priority update runs first.', zh: '调度器将带有优先级（lanes）的更新任务插入堆中。堆确保最高优先级的更新先执行。' },
      { pattern: 'Cooperative Scheduling', path: '/patterns/cooperative-scheduling/', en: 'workLoopConcurrent processes one fiber at a time, checking shouldYield() every 5ms. If the browser needs the thread, React pauses and resumes later.', zh: 'workLoopConcurrent 逐个处理 fiber，每 5ms 检查 shouldYield()。若浏览器需要线程，React 暂停并稍后恢复。' },
      { pattern: 'Diff / Patch', path: '/patterns/diff-patch/', en: 'For each fiber, reconcileChild compares old children vs new children. It finds the minimal set of DOM operations.', zh: '对每个 fiber，reconcileChild 比较新旧 children 列表，找出最小 DOM 操作集。' },
      { pattern: 'Bitmask', path: '/patterns/bitmask/', en: 'Each diffed fiber gets side-effect flags set: Placement|Update|Deletion. Flags are OR\'d together and bubble up the tree.', zh: '每个 diff 过的 fiber 设置副作用标志：Placement|Update|Deletion。标志通过 OR 运算向上冒泡。' },
      { pattern: 'Double Buffering', path: '/patterns/double-buffering/', en: 'The entire render builds on the workInProgress tree. On commit, React swaps current ↔ workInProgress atomically. The old tree becomes the next workInProgress.', zh: '整个渲染在 workInProgress 树上构建。commit 时 React 原子交换 current ↔ workInProgress。旧树变为下一个 workInProgress。' },
    ],
  },
  'game-frame': {
    header: { en: 'Frame N starts', zh: '第 N 帧开始' },
    steps: [
      { pattern: 'Event Loop', path: '/patterns/event-loop/', en: 'The main loop ticks: process input, run physics, update game state, render. Fixed timestep ensures deterministic simulation.', zh: '主循环驱动：处理输入、运行物理、更新游戏状态、渲染。固定时间步保证确定性模拟。' },
      { pattern: 'Object Pool + Free List', path: '/patterns/object-pool/', en: 'Spawning a bullet grabs a slot from the pool (O(1)), not malloc. Destroyed entities return to the free list.', zh: '生成子弹从对象池获取槽位（O(1)），而非 malloc。销毁的实体返回空闲链表。' },
      { pattern: 'Dirty Flag', path: '/patterns/dirty-flag/', en: 'Moving a parent transform marks children dirty. Only recompute world matrices for nodes that actually changed this frame.', zh: '移动父变换会将子节点标记为脏。仅重新计算本帧实际变化的节点的世界矩阵。' },
      { pattern: 'State Machine', path: '/patterns/state-machine/', en: 'Character animation transitions (idle → run → jump) driven by state machine. Each state knows its blend tree and exit rules.', zh: '角色动画过渡（idle → run → jump）由状态机驱动。每个状态知道其混合树和退出规则。' },
      { pattern: 'Batch Processing', path: '/patterns/batch-processing/', en: 'Draw calls are batched by material/texture to minimize GPU state changes. 100 sprites with same texture = 1 draw call.', zh: '按材质/纹理批量合并 draw call 以减少 GPU 状态切换。100 个相同纹理的精灵 = 1 次 draw call。' },
      { pattern: 'Double Buffering', path: '/patterns/double-buffering/', en: 'The back buffer is swapped to front atomically. Players see a complete frame, never a half-drawn one.', zh: '后缓冲区原子交换到前台。玩家看到完整帧，永远不会看到半画的画面。' },
      { pattern: 'Arena Allocator', path: '/patterns/arena-allocator/', en: 'Per-frame temp allocations (particles, debug draws) use a bump allocator. At frame end: reset pointer to zero. Done.', zh: '每帧临时分配（粒子、调试绘制）使用 bump 分配器。帧结束时：指针归零，搞定。' },
    ],
  },
  'linux-read': {
    header: { en: 'read(fd, buf, count)', zh: 'read(fd, buf, count)' },
    footer: { en: 'Data returned to userspace', zh: '数据返回用户空间' },
    steps: [
      { pattern: 'Vtable', path: '/patterns/vtable/', en: 'The VFS layer looks up the file\'s file_operations struct and calls .read(). ext4, NFS, procfs each provide their own implementation behind the same interface.', zh: 'VFS 层查找文件的 file_operations 结构体并调用 .read()。ext4、NFS、procfs 各自在相同接口后提供自己的实现。' },
      { pattern: 'Bitmask', path: '/patterns/bitmask/', en: 'The kernel checks file permission bits (rwxrwxrwx) against the process\'s UID/GID. A single AND operation decides access.', zh: '内核检查文件权限位（rwxrwxrwx）与进程的 UID/GID。单次 AND 运算决定访问权限。' },
      { pattern: 'Reference Counting', path: '/patterns/reference-counting/', en: 'Opening the file incremented its inode refcount. The kernel won\'t free the inode while any fd references it.', zh: '打开文件会增加其 inode 引用计数。只要有 fd 引用，内核就不会释放 inode。' },
      { pattern: 'Batch Processing', path: '/patterns/batch-processing/', en: 'If the read triggers disk I/O, the block layer merges adjacent requests to minimize seek time before dispatching.', zh: '若读取触发磁盘 I/O，块层合并相邻请求以减少寻道时间。' },
      { pattern: 'Ring Buffer', path: '/patterns/ring-buffer/', en: 'ftrace logs the syscall entry/exit into a per-CPU ring buffer for tracing.', zh: 'ftrace 将系统调用的进入/退出记录到 per-CPU 环形缓冲区用于追踪。' },
    ],
  },
  'go-goroutine': {
    header: { en: 'go func() { ... }', zh: 'go func() { ... }' },
    steps: [
      { pattern: 'Free List', path: '/patterns/free-list/', en: 'The runtime allocates goroutine stacks from a fixed-size allocator (fixalloc). No malloc/free per goroutine — just grab a node from the free list.', zh: '运行时通过固定大小分配器（fixalloc）分配 goroutine 栈。无需每个 goroutine 调用 malloc/free — 直接从空闲链表获取节点。' },
      { pattern: 'Object Pool', path: '/patterns/object-pool/', en: 'sync.Pool provides per-P local pools for temporary objects (like fmt buffers). Each P has a private pool → no lock contention.', zh: 'sync.Pool 提供 per-P 本地池用于临时对象（如 fmt 缓冲区）。每个 P 有私有池 → 无锁竞争。' },
      { pattern: 'Cooperative Scheduling', path: '/patterns/cooperative-scheduling/', en: 'The goroutine runs until it hits a preemption point (function call, channel op, or async preemption signal). Then the scheduler picks the next goroutine.', zh: 'goroutine 运行到抢占点（函数调用、channel 操作或异步抢占信号）。然后调度器选择下一个 goroutine。' },
      { pattern: 'Work Stealing', path: '/patterns/work-stealing/', en: 'When a P\'s local run queue is empty, it steals goroutines from another P\'s queue. stealWork() grabs half the victim\'s queue in one batch, keeping all cores busy.', zh: '当 P 的本地运行队列为空时，从其他 P 的队列窃取 goroutine。stealWork() 一次性拿走受害者队列的一半，保持所有核心忙碌。' },
      { pattern: 'Semaphore', path: '/patterns/semaphore/', en: 'When goroutines need bounded concurrency (e.g., errgroup with limit), the weighted semaphore controls how many run at once.', zh: '当 goroutine 需要有界并发（如带限制的 errgroup）时，加权信号量控制同时运行的数量。' },
    ],
  },
  'nodejs-request': {
    header: { en: 'Incoming HTTP request', zh: '收到 HTTP 请求' },
    footer: { en: 'Response sent to client', zh: '响应发送给客户端' },
    steps: [
      { pattern: 'Event Loop', path: '/patterns/event-loop/', en: 'libuv\'s uv_run() picks up the socket event from epoll/kqueue. The request is dispatched to the JS callback on the main thread. No threads blocked.', zh: 'libuv 的 uv_run() 从 epoll/kqueue 获取 socket 事件。请求被分发到主线程的 JS 回调。无线程阻塞。' },
      { pattern: 'Rate Limiter', path: '/patterns/rate-limiter/', en: 'express-rate-limit checks the token bucket. If the client exceeded their quota, respond 429 immediately.', zh: 'express-rate-limit 检查令牌桶。若客户端超出配额，立即返回 429。' },
      { pattern: 'Middleware Chain', path: '/patterns/middleware-chain/', en: 'Koa-compose runs middleware in onion order: auth → validate → handler → log. Each calls next() to proceed or short-circuits on error.', zh: 'Koa-compose 按洋葱模型运行中间件：auth → validate → handler → log。每层调用 next() 继续或遇错短路。' },
      { pattern: 'Observer', path: '/patterns/observer/', en: 'The handler emits events (e.g., \'userCreated\'). EventEmitter notifies all subscribers: cache invalidation, audit log, notification service — all decoupled.', zh: '处理器发出事件（如 \'userCreated\'）。EventEmitter 通知所有订阅者：缓存失效、审计日志、通知服务 — 全部解耦。' },
      { pattern: 'Backpressure', path: '/patterns/backpressure/', en: 'If the response streams a large file, the Writable stream applies highWaterMark. When the client reads slowly, the \'drain\' event pauses the producer to prevent memory blowup.', zh: '若响应流式传输大文件，Writable 流应用 highWaterMark。当客户端读取慢时，\'drain\' 事件暂停生产者以防内存爆炸。' },
    ],
  },
  'rust-build': {
    header: { en: 'cargo build', zh: 'cargo build' },
    steps: [
      { pattern: 'Dependency Graph', path: '/patterns/dependency-graph/', en: 'Cargo resolves the crate dependency DAG and determines compilation order. Independent crates compile in parallel.', zh: 'Cargo 解析 crate 依赖 DAG 并确定编译顺序。独立 crate 并行编译。' },
      { pattern: 'Interning', path: '/patterns/interning/', en: 'rustc interns all identifiers into a global table. Every variable name, type name, and keyword becomes a u32 index. Comparison is O(1) integer equality instead of string compare.', zh: 'rustc 将所有标识符驻留到全局表中。每个变量名、类型名和关键字变为 u32 索引。比较是 O(1) 整数相等而非字符串比较。' },
      { pattern: 'Arena Allocator', path: '/patterns/arena-allocator/', en: 'The compiler allocates AST nodes and type info in per-query arenas. When a query completes, the entire arena is freed — no per-node deallocation overhead.', zh: '编译器在 per-query arena 中分配 AST 节点和类型信息。查询完成后整个 arena 释放 — 无逐节点释放开销。' },
      { pattern: 'Work Stealing', path: '/patterns/work-stealing/', en: 'Tokio\'s multi-thread runtime (used by async Rust programs) steals tasks from idle workers\' queues to keep all cores busy.', zh: 'Tokio 的多线程运行时（async Rust 程序使用）从空闲 worker 的队列窃取任务以保持所有核心忙碌。' },
      { pattern: 'Reference Counting', path: '/patterns/reference-counting/', en: 'Arc<T> enables shared ownership across threads without a GC. The compiler\'s type system guarantees no data races.', zh: 'Arc<T> 实现跨线程共享所有权而无需 GC。编译器的类型系统保证无数据竞争。' },
    ],
  },
  'git-commit': {
    header: { en: 'git commit -m "fix bug"', zh: 'git commit -m "fix bug"' },
    footer: { en: 'New commit object (immutable, content-addressed)', zh: '新的 commit 对象（不可变，内容寻址）' },
    steps: [
      { pattern: 'Diff / Patch', path: '/patterns/diff-patch/', en: 'Git computes the diff between the index (staging area) and the working tree to determine what changed.', zh: 'Git 计算索引（暂存区）与工作树之间的 diff 以确定变更内容。' },
      { pattern: 'Copy-on-Write', path: '/patterns/copy-on-write/', en: 'Changed files become new blob objects. Unchanged files are shared by reference (same SHA-1 → same object). No data is copied unless it actually changed.', zh: '变更的文件成为新的 blob 对象。未变更的文件通过引用共享（相同 SHA-1 → 相同对象）。除非实际变更，否则不复制数据。' },
      { pattern: 'Merkle Tree', path: '/patterns/merkle-tree/', en: 'Tree objects hash their children. A changed blob changes its parent tree hash, which changes the commit hash. Any tampering anywhere is detectable from the root.', zh: 'tree 对象对其子节点哈希。一个 blob 的变更会改变父 tree 的哈希，进而改变 commit 哈希。任何位置的篡改都可从根节点检测。' },
      { pattern: 'Bloom Filter', path: '/patterns/bloom-filter/', en: 'The commit-graph file stores changed-path bloom filters. Future git log queries can skip commits that didn\'t touch a given path without reading the tree.', zh: 'commit-graph 文件存储变更路径的布隆过滤器。后续 git log 查询可跳过未触及指定路径的 commit，无需读取 tree。' },
    ],
  },
  'distributed-write': {
    header: { en: 'Client: PUT /key "value"', zh: '客户端: PUT /key "value"' },
    footer: { en: 'ACK → client (write is durable + replicated)', zh: 'ACK → 客户端（写入已持久化 + 已复制）' },
    steps: [
      { pattern: 'Rate Limiter', path: '/patterns/rate-limiter/', en: 'The gateway applies a token bucket to prevent any single client from overwhelming the cluster.', zh: '网关应用令牌桶防止单个客户端压垮集群。' },
      { pattern: 'Consistent Hashing', path: '/patterns/consistent-hashing/', en: 'The router determines which node owns this key. Virtual nodes ensure load stays balanced even when nodes join/leave.', zh: '路由器确定哪个节点拥有此 key。虚拟节点确保即使节点加入/离开时负载仍保持均衡。' },
      { pattern: 'Write-Ahead Log', path: '/patterns/write-ahead-log/', en: 'Before modifying state, the leader appends the operation to a WAL on disk. If the process crashes, replay recovers state.', zh: '修改状态前，leader 将操作追加到磁盘上的 WAL。若进程崩溃，重放恢复状态。' },
      { pattern: 'Logical Clock', path: '/patterns/logical-clock/', en: 'The write gets a monotonic revision number. No wall-clock sync needed — all nodes agree on ordering via the revision.', zh: '写入获得单调递增的修订号。无需墙钟同步 — 所有节点通过修订号达成排序共识。' },
      { pattern: 'MVCC', path: '/patterns/mvcc/', en: 'The new version is stored alongside old versions. Concurrent readers see a consistent snapshot without blocking the write.', zh: '新版本与旧版本并存。并发读者看到一致性快照而不阻塞写入。' },
      { pattern: 'Checkpointing', path: '/patterns/checkpointing/', en: 'Periodically, the system takes a snapshot. Future crash recovery replays only the WAL entries after the last checkpoint.', zh: '系统定期生成快照。后续崩溃恢复仅重放最后一个检查点之后的 WAL 条目。' },
    ],
  },
};

const flow = computed(() => flows[props.variant]);
const prefix = computed(() => isZh.value ? '/zh' : '');
</script>

<template>
  <div v-if="flow" class="comp-flow viz-container">
    <div class="comp-flow-header">
      <code>{{ isZh ? flow.header.zh : flow.header.en }}</code>
      <span class="comp-flow-arrow">&#x25BC;</span>
    </div>

    <div class="comp-flow-pipeline">
      <div v-for="(step, i) in flow.steps" :key="i" class="comp-flow-step">
        <div class="comp-flow-dot">{{ i + 1 }}</div>
        <div class="comp-flow-body">
          <a :href="prefix + step.path" class="comp-flow-pattern">{{ step.pattern }}</a>
          <p class="comp-flow-desc">{{ isZh ? step.zh : step.en }}</p>
        </div>
        <div v-if="i < flow.steps.length - 1" class="comp-flow-connector">
          <span class="comp-flow-line"></span>
        </div>
      </div>
    </div>

    <div v-if="flow.footer" class="comp-flow-footer">
      <span class="comp-flow-arrow">&#x25BC;</span>
      <code>{{ isZh ? flow.footer.zh : flow.footer.en }}</code>
    </div>
  </div>
</template>

<style scoped>
.comp-flow {
  padding: 1.25rem;
}

.comp-flow-header,
.comp-flow-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}

.comp-flow-header code,
.comp-flow-footer code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--viz-text);
  background: var(--vp-c-bg);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--viz-border);
}

.comp-flow-arrow {
  color: var(--viz-muted);
  font-size: 0.75rem;
  line-height: 1;
}

.comp-flow-pipeline {
  margin: 0.75rem 0;
}

.comp-flow-step {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  margin: 0;
  background: var(--vp-c-bg);
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  transition: border-color 0.15s ease;
}

.comp-flow-step:hover {
  border-color: var(--viz-primary);
}

.comp-flow-step + .comp-flow-step {
  margin-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.comp-flow-step:not(:last-child) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-style: dashed;
}

.comp-flow-dot {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--viz-primary);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.125rem;
}

.comp-flow-body {
  flex: 1;
  min-width: 0;
}

.comp-flow-pattern {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--viz-primary);
  text-decoration: none;
}

.comp-flow-pattern:hover {
  text-decoration: underline;
}

.comp-flow-desc {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--viz-text);
  opacity: 0.85;
}

.comp-flow-connector {
  display: none;
}
</style>
