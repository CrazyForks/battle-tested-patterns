<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

const BLOCK_COUNT = 10;

interface Block {
  id: number;
  allocated: boolean;
  label: string;
}

const blocks = ref<Block[]>(initBlocks());
const freeListOrder = ref<number[]>(Array.from({ length: BLOCK_COUNT }, (_, i) => i));
let allocCounter = 0;
const customLabel = ref('');
const message = ref(t(
  'All blocks free — type a label and click "Allocate". Free lists power malloc, game engines, and kernel slab allocators.',
  '所有块空闲 — 输入标签后点击"分配"。Free List 驱动 malloc、游戏引擎和内核 slab 分配器。'
));
let presetRunning = false;

function initBlocks(): Block[] {
  return Array.from({ length: BLOCK_COUNT }, (_, i) => ({
    id: i,
    allocated: false,
    label: '',
  }));
}

const freeHead = computed(() =>
  freeListOrder.value.length > 0 ? freeListOrder.value[0] : null
);
const allocatedCount = computed(() => blocks.value.filter(b => b.allocated).length);
const freeCount = computed(() => freeListOrder.value.length);

function allocate() {
  if (freeListOrder.value.length === 0) {
    message.value = t(
      'Out of memory! No free blocks available. This is what happens when malloc returns NULL — the kernel OOM killer may intervene.',
      '内存耗尽！没有可用的空闲块。这就是 malloc 返回 NULL 时发生的事 — 内核 OOM killer 可能介入。'
    );
    return;
  }

  const blockId = freeListOrder.value[0];
  freeListOrder.value = freeListOrder.value.slice(1);

  const label = customLabel.value.trim() || `obj${++allocCounter}`;
  customLabel.value = '';

  blocks.value[blockId].allocated = true;
  blocks.value[blockId].label = label;

  const newHead = freeHead.value;
  message.value = t(
    `Allocated block ${blockId} as "${label}" — O(1) pop from head. New head: ${newHead !== null ? newHead : 'null'}. LIFO order means recently freed blocks are reused first (cache-friendly).`,
    `已分配块 ${blockId} 为 "${label}" — O(1) 从头部弹出。新 head: ${newHead !== null ? newHead : 'null'}。LIFO 顺序意味着最近释放的块优先复用（缓存友好）。`
  );
}

function freeBlock(id: number) {
  const block = blocks.value[id];
  if (!block.allocated) return;

  const oldLabel = block.label;
  block.allocated = false;
  block.label = '';

  freeListOrder.value = [id, ...freeListOrder.value];

  message.value = t(
    `Freed block ${id} ("${oldLabel}") — O(1) prepend to head. LIFO: block ${id} will be allocated next. This is how jemalloc and tcmalloc work.`,
    `已释放块 ${id}（"${oldLabel}"）— O(1) 插入头部。LIFO：块 ${id} 将被下次分配。jemalloc 和 tcmalloc 就是这样工作的。`
  );
}

function freeAll() {
  const freedIds: number[] = [];
  for (const block of blocks.value) {
    if (block.allocated) {
      block.allocated = false;
      block.label = '';
      freedIds.push(block.id);
    }
  }
  if (freedIds.length === 0) {
    message.value = t('Nothing to free — all blocks are already free', '无需释放 — 所有块已经是空闲的');
    return;
  }
  freeListOrder.value = [...freedIds.reverse(), ...freeListOrder.value];
  message.value = t(
    `Freed ${freedIds.length} block(s) — all returned to free list`,
    `已释放 ${freedIds.length} 个块 — 全部归还到 Free List`
  );
}

function reset() {
  clearAll();
  blocks.value = initBlocks();
  freeListOrder.value = Array.from({ length: BLOCK_COUNT }, (_, i) => i);
  allocCounter = 0;
  customLabel.value = '';
  presetRunning = false;
  message.value = t(
    'Reset complete — free list restored to initial order [0 → 1 → ... → 9 → null]',
    '重置完成 — Free List 恢复初始顺序 [0 → 1 → ... → 9 → null]'
  );
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') allocate();
}

async function presetAllocFree() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Alloc-free cycle: allocate 3 blocks, free the middle one, allocate again. The freed block gets reused — LIFO ensures temporal locality. This is the core loop of any memory allocator.',
    '分配-释放循环：分配 3 个块，释放中间的，再分配。被释放的块被复用 — LIFO 确保时间局部性。这是任何内存分配器的核心循环。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  allocate(); await delay(500);
  if (!presetRunning || isAborted()) return;
  allocate(); await delay(500);
  if (!presetRunning || isAborted()) return;
  allocate(); await delay(600);
  if (!presetRunning || isAborted()) return;
  freeBlock(1);
  await delay(600);
  if (!presetRunning || isAborted()) return;
  allocate();
  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Block 1 was freed and immediately reused — LIFO order. Hot cache lines stay warm. Linux kernel slab allocator uses this exact pattern for struct allocation.',
    '块 1 被释放后立即复用 — LIFO 顺序。热缓存行保持温度。Linux 内核 slab 分配器用完全相同的模式分配 struct。'
  );
  presetRunning = false;
}

async function presetExhaustion() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Pool exhaustion: allocate all 10 blocks, then try one more. Fixed-size pools prevent heap fragmentation but require capacity planning.',
    '池耗尽：分配全部 10 个块，然后再尝试一个。固定大小的池防止堆碎片化，但需要容量规划。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < BLOCK_COUNT; i++) {
    if (!presetRunning || isAborted()) return;
    allocate();
    await delay(300);
  }
  if (!presetRunning || isAborted()) return;
  await delay(400);
  allocate();
  presetRunning = false;
}

async function presetFragmentation() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Fragmentation demo: allocate 5, free odds (1,3), allocate 2. Free list reuses gaps — no external fragmentation. This is why game engines prefer pool allocators over general-purpose malloc.',
    '碎片化演示：分配 5 个，释放奇数位（1,3），分配 2 个。Free list 复用间隙 — 无外部碎片化。这就是游戏引擎偏好池分配器而非通用 malloc 的原因。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < 5; i++) {
    if (!presetRunning || isAborted()) return;
    allocate();
    await delay(300);
  }
  if (!presetRunning || isAborted()) return;
  freeBlock(1); await delay(400);
  if (!presetRunning || isAborted()) return;
  freeBlock(3); await delay(400);
  if (!presetRunning || isAborted()) return;
  allocate(); await delay(400);
  if (!presetRunning || isAborted()) return;
  allocate(); await delay(400);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Freed slots 1 and 3 were filled by new allocations. Zero fragmentation — every block is the same size. Unity ECS and Unreal use this for component storage.',
    '释放的槽位 1 和 3 被新分配填充。零碎片化 — 每个块大小相同。Unity ECS 和 Unreal 用此方式存储组件。'
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Free List', '交互式 Free List') }}</div>

    <!-- Stats -->
    <div class="fl-stats">
      <div class="fl-stat">
        <span class="fl-stat-value">{{ BLOCK_COUNT }}</span>
        <span class="viz-label">{{ t('Total', '总计') }}</span>
      </div>
      <div class="fl-stat">
        <span class="fl-stat-value fl-stat--alloc">{{ allocatedCount }}</span>
        <span class="viz-label">{{ t('Allocated', '已分配') }}</span>
      </div>
      <div class="fl-stat">
        <span class="fl-stat-value fl-stat--free">{{ freeCount }}</span>
        <span class="viz-label">{{ t('Free', '空闲') }}</span>
      </div>
      <div class="fl-stat">
        <span class="fl-stat-value fl-stat--head">{{ freeHead !== null ? freeHead : '---' }}</span>
        <span class="viz-label">head</span>
      </div>
    </div>

    <!-- Memory blocks -->
    <div class="fl-memory">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="fl-block"
        :class="{
          'fl-block--allocated': block.allocated,
          'fl-block--head': freeHead === block.id,
          'fl-block--free': !block.allocated,
        }"
        @click="block.allocated ? freeBlock(block.id) : undefined"
        :role="block.allocated ? 'button' : undefined"
        :tabindex="block.allocated ? 0 : undefined"
        :title="block.allocated
          ? t('Click to free block ' + block.id + ' (' + block.label + ')', '点击释放块 ' + block.id + '（' + block.label + '）')
          : t('Free block', '空闲块')"
      >
        <div class="fl-block-id">#{{ block.id }}</div>
        <div class="fl-block-content">
          <template v-if="block.allocated">{{ block.label }}</template>
          <template v-else>{{ t('free', '空闲') }}</template>
        </div>
        <div v-if="block.allocated" class="fl-block-hint">
          {{ t('click to free', '点击释放') }}
        </div>
        <div v-if="freeHead === block.id && !block.allocated" class="fl-block-head-badge">
          head
        </div>
      </div>
    </div>

    <!-- Free list chain -->
    <div class="fl-chain">
      <span class="fl-chain-label">{{ t('Free list chain:', 'Free List 链:') }}</span>
      <template v-if="freeListOrder.length > 0">
        <span class="fl-chain-item fl-chain-head">head</span>
        <template v-for="(id, i) in freeListOrder" :key="'fl-' + id">
          <svg class="fl-chain-arrow" viewBox="0 0 24 12" width="24" height="12">
            <path d="M2 6 L18 6 M14 2 L18 6 L14 10" stroke="var(--viz-primary)" stroke-width="1.5" fill="none"/>
          </svg>
          <span class="fl-chain-item">{{ id }}</span>
        </template>
        <svg class="fl-chain-arrow" viewBox="0 0 24 12" width="24" height="12">
          <path d="M2 6 L18 6 M14 2 L18 6 L14 10" stroke="var(--viz-muted)" stroke-width="1.5" fill="none"/>
        </svg>
        <span class="fl-chain-item fl-chain-null">null</span>
      </template>
      <template v-else>
        <span class="fl-chain-item fl-chain-null">
          {{ t('empty (all blocks allocated)', '空（所有块已分配）') }}
        </span>
      </template>
    </div>

    <!-- Controls -->
    <div class="fl-controls">
      <div class="fl-input-group">
        <input
          v-model="customLabel"
          class="fl-input"
          type="text"
          maxlength="8"
          :placeholder="t('Label (optional)', '标签（可选）')"
          @keydown="handleKeydown"
        />
        <button class="viz-btn viz-btn--primary" @click="allocate">
          {{ t('Allocate', '分配') }}
        </button>
      </div>
      <div class="fl-btn-group">
        <button class="viz-btn viz-btn--secondary" @click="freeAll">
          {{ t('Free All', '全部释放') }}
        </button>
        <button class="viz-btn viz-btn--danger" @click="reset">
          {{ t('Reset', '重置') }}
        </button>
        <div class="viz-speed">
          <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
          <span class="viz-speed-val">{{ speed }}x</span>
        </div>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetAllocFree">{{ t('Alloc/Free Cycle', '分配/释放循环') }}</button>
      <button class="viz-btn" @click="presetExhaustion">{{ t('Pool Exhaustion', '池耗尽') }}</button>
      <button class="viz-btn" @click="presetFragmentation">{{ t('Zero Fragmentation', '零碎片化') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
/* --- Stats --- */
.fl-stats {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.fl-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 52px;
}

.fl-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.fl-stat--alloc { color: var(--viz-cell-filled); }
.fl-stat--free { color: var(--viz-success); }
.fl-stat--head { color: var(--viz-primary); }

/* --- Memory blocks --- */
.fl-memory {
  display: flex;
  gap: 3px;
  padding: 0.75rem 0;
  overflow-x: auto;
}

.fl-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  flex: 1;
  border: 2px solid var(--viz-border);
  border-radius: 6px;
  padding: 0.375rem 0.25rem;
  background: var(--vp-c-bg);
  transition: all 0.25s ease;
  cursor: default;
  position: relative;
}

.fl-block--free {
  background: var(--viz-cell-empty);
}

.fl-block--allocated {
  border-color: var(--viz-cell-filled);
  background: var(--viz-cell-filled);
  cursor: pointer;
  animation: fl-alloc-in 0.3s ease;
}

.fl-block--allocated:hover {
  opacity: 0.8;
  transform: translateY(-2px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.fl-block--head {
  border-color: var(--viz-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.fl-block-id {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
  margin-bottom: 1px;
}

.fl-block--allocated .fl-block-id {
  color: rgba(255, 255, 255, 0.7);
}

.fl-block-content {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fl-block--allocated .fl-block-content {
  color: #fff;
}

.fl-block-hint {
  font-size: 0.5rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
  white-space: nowrap;
}

.fl-block-head-badge {
  position: absolute;
  top: -8px;
  right: -6px;
  font-size: 0.5rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: #fff;
  background: var(--viz-primary);
  padding: 0 4px;
  border-radius: 3px;
  line-height: 1.4;
}

/* --- Free list chain --- */
.fl-chain {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 0;
  overflow-x: auto;
  flex-wrap: nowrap;
}

.fl-chain-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-right: 0.25rem;
  white-space: nowrap;
}

.fl-chain-item {
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--viz-primary);
  border-radius: 4px;
  color: var(--viz-primary);
  background: var(--vp-c-bg);
  white-space: nowrap;
}

.fl-chain-head {
  background: var(--viz-primary);
  color: #fff;
}

.fl-chain-null {
  border-color: var(--viz-muted);
  color: var(--viz-muted);
  font-style: italic;
}

.fl-chain-arrow {
  flex-shrink: 0;
}

/* --- Controls --- */
.fl-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0;
}

.fl-input-group {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.fl-input {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--viz-text);
  width: 120px;
  outline: none;
  transition: border-color 0.2s ease;
}

.fl-input:focus {
  border-color: var(--viz-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.fl-input::placeholder {
  color: var(--viz-muted);
  font-size: 0.75rem;
}

.fl-btn-group {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.viz-btn--secondary {
  background: var(--vp-c-bg);
  border-color: var(--viz-primary);
  color: var(--viz-primary);
}

.viz-btn--secondary:hover {
  background: var(--viz-primary);
  color: #fff;
}

/* --- Animations --- */
@keyframes fl-alloc-in {
  from { opacity: 0.5; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

/* --- Responsive --- */
@media (max-width: 640px) {
  .fl-block {
    min-width: 42px;
    padding: 0.25rem 0.15rem;
  }
  .fl-block-content {
    font-size: 0.6875rem;
  }
  .fl-block-hint {
    display: none;
  }
  .fl-input {
    width: 90px;
  }
  .fl-controls {
    flex-direction: column;
  }
}
</style>
