<script setup lang="ts">
import { computed } from 'vue';
import { withBase } from 'vitepress';
import { useI18n } from '../composables/useI18n';

const { isZh } = useI18n();
const props = defineProps<{ variant: string }>();

const zhNames: Record<string, string> = {
  'LRU Cache': 'LRU 缓存',
  'B+ Tree with TTL': 'B+ 树 + TTL',
  'Bloom Filter': '布隆过滤器',
  'Hash map': '哈希表',
  'Object Pool / Free List': '对象池 / 空闲链表',
  'Arena Allocator': 'Arena 分配器',
  'Flyweight / Interning': '享元 / 驻留',
  'Copy-on-Write / Ref Counting': '写时复制 / 引用计数',
  'Actor Model': 'Actor 模型',
  MVCC: 'MVCC',
  Semaphore: '信号量',
  'Work Stealing': '工作窃取',
  'Event Loop': '事件循环',
  Bitmask: '位掩码',
  'Skip List': '跳表',
  'B+ Tree': 'B+ 树',
  'Ring Buffer': '环形缓冲区',
  Backpressure: '背压',
  'Copy-on-Write': '写时复制',
  'Circuit Breaker': '熔断器',
  'Rate Limiter': '限流器',
  'Retry with Backoff': '指数退避重试',
  'WAL + Checkpointing': 'WAL + 检查点',
  'Object Pool': '对象池',
  'Free List': '空闲链表',
};

function pn(en: string | undefined): string {
  if (!en) return '';
  return isZh.value ? zhNames[en] || en : en;
}

interface Branch {
  label: { en: string; zh: string };
  pattern?: string;
  path?: string;
  note?: { en: string; zh: string };
  sub?: TreeNode;
}

interface TreeNode {
  q: { en: string; zh: string };
  branches: Branch[];
}

interface TreeGroup {
  title?: { en: string; zh: string };
  roots: TreeNode[];
}

function q(en: string, zh: string): { en: string; zh: string } {
  return { en, zh };
}
function leaf(
  labelEn: string,
  labelZh: string,
  pattern: string,
  path: string,
  noteEn?: string,
  noteZh?: string,
): Branch {
  const b: Branch = { label: q(labelEn, labelZh), pattern, path };
  if (noteEn) b.note = q(noteEn, noteZh || noteEn);
  return b;
}
function branch(labelEn: string, labelZh: string, sub: TreeNode): Branch {
  return { label: q(labelEn, labelZh), sub };
}

const trees: Record<string, TreeGroup> = {
  'which-cache': {
    roots: [
      {
        q: q('Need eviction?', '需要淘汰吗？'),
        branches: [
          branch('Yes', '是', {
            q: q('Need O(1) ops?', '需要 O(1) 操作？'),
            branches: [
              leaf('Yes', '是', 'LRU Cache', '/patterns/lru-cache/'),
              leaf('No', '否', 'B+ Tree with TTL', '/patterns/b-plus-tree/'),
            ],
          }),
          branch('No', '否', {
            q: q('Need probabilistic filter?', '需要概率性过滤？'),
            branches: [
              leaf(
                'Yes',
                '是',
                'Bloom Filter',
                '/patterns/bloom-filter/',
                'Not a cache, but saves cache misses',
                '不是缓存，但能省缓存未命中',
              ),
              leaf('No', '否', 'Hash map', '', 'A hash map is fine', '普通哈希表就够了'),
            ],
          }),
        ],
      },
    ],
  },

  'which-memory': {
    roots: [
      {
        q: q('All objects same size?', '所有对象大小相同？'),
        branches: [
          leaf('Yes', '是', 'Object Pool / Free List', '/patterns/object-pool/'),
          branch('No', '否', {
            q: q('Phase-based lifetime?', '阶段性生命周期？'),
            branches: [
              leaf('Yes', '是', 'Arena Allocator', '/patterns/arena-allocator/'),
              branch('No', '否', {
                q: q('Shared immutable?', '共享不可变？'),
                branches: [
                  leaf('Yes', '是', 'Flyweight / Interning', '/patterns/flyweight/'),
                  leaf('No', '否', 'Copy-on-Write / Ref Counting', '/patterns/copy-on-write/'),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  },

  'which-concurrency': {
    roots: [
      {
        q: q('Shared state?', '共享状态？'),
        branches: [
          leaf('No', '否', 'Actor Model', '/patterns/actor-model/', 'Message passing', '消息传递'),
          branch('Yes', '是', {
            q: q('Read-heavy?', '读多？'),
            branches: [
              leaf('Yes', '是', 'MVCC', '/patterns/mvcc/', 'Readers never block', '读者永不阻塞'),
              branch('No', '否', {
                q: q('Need limit on concurrency?', '需要限制并发数？'),
                branches: [
                  leaf('Yes', '是', 'Semaphore', '/patterns/semaphore/'),
                  branch('No', '否', {
                    q: q('Need to split work?', '需要分配工作？'),
                    branches: [
                      leaf('Yes', '是', 'Work Stealing', '/patterns/work-stealing/'),
                      leaf(
                        'No',
                        '否',
                        'Event Loop',
                        '/patterns/event-loop/',
                        'Single-thread I/O',
                        '单线程 I/O',
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  },

  'pattern-selector': {
    roots: [
      {
        q: q('Need to store/retrieve data?', '需要存储/检索数据？'),
        branches: [
          leaf('Fixed set of flags?', '固定的标志位集合？', 'Bitmask', '/patterns/bitmask/'),
          branch('Ordered access needed?', '需要有序访问？', {
            q: q('Where?', '在哪里？'),
            branches: [
              leaf('In memory', '在内存中', 'Skip List', '/patterns/skip-list/'),
              leaf('On disk', '在磁盘上', 'B+ Tree', '/patterns/b-plus-tree/'),
            ],
          }),
          leaf(
            'Approximate membership?',
            '近似成员检测？',
            'Bloom Filter',
            '/patterns/bloom-filter/',
          ),
          leaf('Key-value with eviction?', '键值对 + 淘汰？', 'LRU Cache', '/patterns/lru-cache/'),
          leaf(
            'FIFO with fixed capacity?',
            '固定容量 FIFO？',
            'Ring Buffer',
            '/patterns/ring-buffer/',
          ),
        ],
      },
      {
        q: q('Need to manage concurrency?', '需要管理并发？'),
        branches: [
          leaf('Limit concurrent access?', '限制并发访问？', 'Semaphore', '/patterns/semaphore/'),
          leaf(
            'Producer faster than consumer?',
            '生产者快于消费者？',
            'Backpressure',
            '/patterns/backpressure/',
          ),
          leaf(
            'Shared data, rare writes?',
            '共享数据，写入稀少？',
            'Copy-on-Write',
            '/patterns/copy-on-write/',
          ),
          leaf('Multiple writers, no blocking?', '多写者，不阻塞？', 'MVCC', '/patterns/mvcc/'),
          leaf('Independent actors?', '独立的 Actor？', 'Actor Model', '/patterns/actor-model/'),
        ],
      },
      {
        q: q('Need resilience?', '需要弹性？'),
        branches: [
          leaf(
            'Downstream failing?',
            '下游故障？',
            'Circuit Breaker',
            '/patterns/circuit-breaker/',
          ),
          leaf('Too many requests?', '请求过多？', 'Rate Limiter', '/patterns/rate-limiter/'),
          leaf('Transient errors?', '瞬态错误？', 'Retry with Backoff', '/patterns/retry-backoff/'),
          leaf(
            'Need crash recovery?',
            '需要崩溃恢复？',
            'WAL + Checkpointing',
            '/patterns/write-ahead-log/',
          ),
        ],
      },
      {
        q: q('Need memory efficiency?', '需要内存效率？'),
        branches: [
          leaf(
            'Many identical objects?',
            '大量相同对象？',
            'Flyweight / Interning',
            '/patterns/flyweight/',
          ),
          leaf(
            'Reuse expensive objects?',
            '复用昂贵对象？',
            'Object Pool',
            '/patterns/object-pool/',
          ),
          leaf(
            'Phase-based allocation?',
            '阶段性分配？',
            'Arena Allocator',
            '/patterns/arena-allocator/',
          ),
          leaf(
            'Recycle fixed-size slots?',
            '回收固定大小槽位？',
            'Free List',
            '/patterns/free-list/',
          ),
        ],
      },
    ],
  },
};

const group = computed(() => trees[props.variant]);
const prefix = computed(() => (isZh.value ? '/zh' : ''));
function txt(obj: { en: string; zh: string }): string {
  return isZh.value ? obj.zh : obj.en;
}
</script>

<template>
  <div v-if="group" class="dt viz-container">
    <div
      v-for="(root, ri) in group.roots"
      :key="ri"
      class="dt-root"
      :class="{ 'dt-root--spaced': ri > 0 }"
    >
      <div class="dt-question dt-question--root">
        <span class="dt-q-icon">?</span>
        <span class="dt-q-text">{{ txt(root.q) }}</span>
      </div>
      <ul class="dt-branches">
        <li v-for="(b, bi) in root.branches" :key="bi" class="dt-branch">
          <template v-if="b.sub">
            <span class="dt-label">{{ txt(b.label) }}</span>
            <div class="dt-question">
              <span class="dt-q-icon dt-q-icon--sm">?</span>
              <span class="dt-q-text">{{ txt(b.sub.q) }}</span>
            </div>
            <ul class="dt-branches">
              <li v-for="(b2, b2i) in b.sub.branches" :key="b2i" class="dt-branch">
                <template v-if="b2.sub">
                  <span class="dt-label">{{ txt(b2.label) }}</span>
                  <div class="dt-question">
                    <span class="dt-q-icon dt-q-icon--sm">?</span>
                    <span class="dt-q-text">{{ txt(b2.sub.q) }}</span>
                  </div>
                  <ul class="dt-branches">
                    <li v-for="(b3, b3i) in b2.sub.branches" :key="b3i" class="dt-branch">
                      <template v-if="b3.sub">
                        <span class="dt-label">{{ txt(b3.label) }}</span>
                        <div class="dt-question">
                          <span class="dt-q-icon dt-q-icon--sm">?</span>
                          <span class="dt-q-text">{{ txt(b3.sub.q) }}</span>
                        </div>
                        <ul class="dt-branches">
                          <li v-for="(b4, b4i) in b3.sub.branches" :key="b4i" class="dt-branch">
                            <span class="dt-label">{{ txt(b4.label) }}</span>
                            <a v-if="b4.path" :href="withBase(prefix + b4.path)" class="dt-leaf">
                              <span class="dt-leaf-name">{{ pn(b4.pattern) }}</span>
                              <span v-if="b4.note" class="dt-leaf-note">{{ txt(b4.note) }}</span>
                            </a>
                            <span v-else class="dt-leaf dt-leaf--plain">
                              <span class="dt-leaf-name">{{ pn(b4.pattern) }}</span>
                              <span v-if="b4.note" class="dt-leaf-note">{{ txt(b4.note) }}</span>
                            </span>
                          </li>
                        </ul>
                      </template>
                      <template v-else>
                        <span class="dt-label">{{ txt(b3.label) }}</span>
                        <a v-if="b3.path" :href="withBase(prefix + b3.path)" class="dt-leaf">
                          <span class="dt-leaf-name">{{ pn(b3.pattern) }}</span>
                          <span v-if="b3.note" class="dt-leaf-note">{{ txt(b3.note) }}</span>
                        </a>
                        <span v-else class="dt-leaf dt-leaf--plain">
                          <span class="dt-leaf-name">{{ pn(b3.pattern) }}</span>
                          <span v-if="b3.note" class="dt-leaf-note">{{ txt(b3.note) }}</span>
                        </span>
                      </template>
                    </li>
                  </ul>
                </template>
                <template v-else>
                  <span class="dt-label">{{ txt(b2.label) }}</span>
                  <a v-if="b2.path" :href="withBase(prefix + b2.path)" class="dt-leaf">
                    <span class="dt-leaf-name">{{ pn(b2.pattern) }}</span>
                    <span v-if="b2.note" class="dt-leaf-note">{{ txt(b2.note) }}</span>
                  </a>
                  <span v-else class="dt-leaf dt-leaf--plain">
                    <span class="dt-leaf-name">{{ pn(b2.pattern) }}</span>
                    <span v-if="b2.note" class="dt-leaf-note">{{ txt(b2.note) }}</span>
                  </span>
                </template>
              </li>
            </ul>
          </template>
          <template v-else>
            <span class="dt-label">{{ txt(b.label) }}</span>
            <a v-if="b.path" :href="withBase(prefix + b.path)" class="dt-leaf">
              <span class="dt-leaf-name">{{ pn(b.pattern) }}</span>
              <span v-if="b.note" class="dt-leaf-note">{{ txt(b.note) }}</span>
            </a>
            <span v-else class="dt-leaf dt-leaf--plain">
              <span class="dt-leaf-name">{{ pn(b.pattern) }}</span>
              <span v-if="b.note" class="dt-leaf-note">{{ txt(b.note) }}</span>
            </span>
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.dt {
  padding: 1.25rem;
}

.dt-root--spaced {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px dashed var(--viz-border);
}

.dt-question {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.dt-q-icon {
  flex-shrink: 0;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  background: var(--viz-primary);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dt-q-icon--sm {
  width: 1.125rem;
  height: 1.125rem;
  font-size: 0.625rem;
  background: var(--viz-muted);
}

.dt-q-text {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--viz-text);
}

.dt-question--root .dt-q-text {
  font-size: 0.9375rem;
}

.dt-branches {
  list-style: none;
  margin: 0;
  padding: 0 0 0 0.6875rem;
  border-left: 2px solid var(--viz-border);
}

.dt-branch {
  position: relative;
  padding: 0.375rem 0 0.375rem 1rem;
}

.dt-branch::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0.875rem;
  width: 0.75rem;
  height: 0;
  border-top: 2px solid var(--viz-border);
}

.dt-branch:last-child {
  border-left: 2px solid transparent;
}

.dt-branch:last-child::before {
  border-left: 2px solid var(--viz-border);
  height: calc(0.875rem);
  top: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: var(--viz-radius-sm);
  border-top: none;
  border-bottom: 2px solid var(--viz-border);
}

.dt-label {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--viz-muted);
  background: var(--vp-c-bg);
  padding: 0.0625rem 0.375rem;
  border-radius: var(--viz-radius-sm);
  border: 1px solid var(--viz-border);
  margin-bottom: 0.25rem;
  line-height: 1.4;
}

.dt-leaf {
  display: inline-flex;
  align-items: baseline;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--viz-radius-sm);
  background: rgb(59 130 246 / 8%);
  border: 1px solid var(--viz-primary);
  text-decoration: none;
  transition: all var(--viz-transition);
  margin-top: 0.125rem;
}

.dt-leaf:hover {
  background: rgb(59 130 246 / 16%);
  box-shadow: 0 0 8px rgb(59 130 246 / 12%);
}

.dt-leaf--plain {
  border-color: var(--viz-border);
  background: var(--vp-c-bg);
  cursor: default;
}

.dt-leaf--plain:hover {
  background: var(--vp-c-bg);
  box-shadow: none;
}

.dt-leaf-name {
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--viz-primary);
}

.dt-leaf--plain .dt-leaf-name {
  color: var(--viz-text);
}

.dt-leaf-note {
  font-size: 0.6875rem;
  color: var(--viz-muted);
  font-style: italic;
}

@media (width <= 640px) {
  .dt {
    padding: 0.75rem;
  }

  .dt-branches {
    padding-left: 0.5rem;
  }

  .dt-branch {
    padding-left: 0.625rem;
  }

  .dt-q-text {
    font-size: 0.8125rem;
  }

  .dt-leaf {
    padding: 0.1875rem 0.5rem;
  }
}
</style>
