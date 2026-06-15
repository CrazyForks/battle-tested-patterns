<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll: clearTimers, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface Allocation {
  id: number;
  offset: number;
  size: number;
  color: string;
  label: string;
  arenaIndex: number;
}

interface Arena {
  id: number;
  capacity: number;
  pointer: number;
  allocations: Allocation[];
}

const ARENA_CAPACITY = 32;
const COLORS = [
  'var(--viz-primary)',
  'var(--viz-success)',
  'var(--viz-warning)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#e11d48',
];

const SIZE_OPTIONS = [
  { label: () => t('Small (1)', '小 (1)'), value: 1 },
  { label: () => t('Medium (2)', '中 (2)'), value: 2 },
  { label: () => t('Large (4)', '大 (4)'), value: 4 },
];

let globalAllocId = 1;
let globalColorIdx = 0;
let arenaIdCounter = 1;

const selectedSize = ref(2);
const customLabel = ref('');
let presetRunning = false;

const arenas = ref<Arena[]>([
  { id: arenaIdCounter++, capacity: ARENA_CAPACITY, pointer: 0, allocations: [] },
]);

const activeArenaIndex = ref(0);

interface ArenaSnapshot {
  arenas: Arena[];
  activeArenaIndex: number;
}

const vizHistory = useVizHistory<ArenaSnapshot>(
  { arenas: arenas.value, activeArenaIndex: activeArenaIndex.value },
  {
    getMessage: () => message.value,
    onRestore(snapshot, msg) {
      presetRunning = false;
      arenas.value = snapshot.arenas;
      activeArenaIndex.value = snapshot.activeArenaIndex;
      if (msg !== undefined) message.value = msg;
    },
  },
);

interface HistoryEntry {
  action: 'alloc' | 'reset' | 'new-arena';
  arenaId: number;
  label?: string;
  offset?: number;
  size?: number;
  timestamp: number;
}

const history = reactive<HistoryEntry[]>([]);

const message = ref(
  t(
    "Arena allocator: bump a pointer forward to allocate, free everything at once. Used by compilers (LLVM), game engines (Unreal), and Go's escape analysis.",
    'Arena 分配器：向前移动指针来分配，一次性释放所有内容。编译器（LLVM）、游戏引擎（Unreal）和 Go 的逃逸分析都使用此模式。',
  ),
);

const activeArena = computed(() => arenas.value[activeArenaIndex.value]);

const totalCapacity = computed(() => arenas.value.reduce((sum, a) => sum + a.capacity, 0));
const totalUsed = computed(() => arenas.value.reduce((sum, a) => sum + a.pointer, 0));
const totalAllocations = computed(() =>
  arenas.value.reduce((sum, a) => sum + a.allocations.length, 0),
);

function nextColor(): string {
  const c = COLORS[globalColorIdx % COLORS.length];
  globalColorIdx++;
  return c;
}

function generateLabel(): string {
  if (customLabel.value.trim()) {
    const lbl = customLabel.value.trim();
    customLabel.value = '';
    return lbl;
  }
  return `obj${globalAllocId}`;
}

function allocate() {
  const size = selectedSize.value;
  const arena = activeArena.value;

  if (arena.pointer + size > arena.capacity) {
    message.value = t(
      `Cannot allocate ${size} unit(s) in Arena #${arena.id} — only ${arena.capacity - arena.pointer} free. Add a new arena (chaining) or reset.`,
      `无法在 Arena #${arena.id} 中分配 ${size} 个单元 — 仅剩 ${arena.capacity - arena.pointer} 可用。添加新 Arena（链式）或重置。`,
    );
    log(message.value, 'warning');
    return;
  }

  const label = generateLabel();
  const alloc: Allocation = {
    id: globalAllocId++,
    offset: arena.pointer,
    size,
    color: nextColor(),
    label,
    arenaIndex: activeArenaIndex.value,
  };

  arena.allocations = [...arena.allocations, alloc];
  arena.pointer += size;

  history.push({
    action: 'alloc',
    arenaId: arena.id,
    label: alloc.label,
    offset: alloc.offset,
    size: alloc.size,
    timestamp: Date.now(),
  });

  message.value = t(
    `Allocated "${alloc.label}" (${size} unit(s)) at offset ${alloc.offset} — pointer bumped to ${arena.pointer}. O(1) allocation: just increment a pointer, no free-list traversal.`,
    `已分配 "${alloc.label}" (${size} 个单元) 在偏移量 ${alloc.offset} — 指针移至 ${arena.pointer}。O(1) 分配：只需递增指针，无需遍历空闲链表。`,
  );
  log(message.value, 'info');
  vizHistory.commit(
    { arenas: arenas.value, activeArenaIndex: activeArenaIndex.value },
    `alloc ${alloc.label}`,
  );
}

function resetArena(index: number) {
  const arena = arenas.value[index];
  arena.pointer = 0;
  arena.allocations = [];

  history.push({
    action: 'reset',
    arenaId: arena.id,
    timestamp: Date.now(),
  });

  message.value = t(
    `Arena #${arena.id} reset — all memory freed in O(1). No per-object destructor calls. This is why arena allocation is 10-100x faster than malloc/free.`,
    `Arena #${arena.id} 已重置 — 所有内存 O(1) 释放。没有逐对象析构调用。这就是 arena 分配比 malloc/free 快 10-100 倍的原因。`,
  );
  log(message.value, 'warning');
  vizHistory.commit(
    { arenas: arenas.value, activeArenaIndex: activeArenaIndex.value },
    `free arena #${arena.id}`,
  );
}

function resetAll() {
  clearTimers();
  arenas.value = [{ id: arenaIdCounter++, capacity: ARENA_CAPACITY, pointer: 0, allocations: [] }];
  activeArenaIndex.value = 0;
  globalAllocId = 1;
  globalColorIdx = 0;
  history.length = 0;
  presetRunning = false;
  vizHistory.reset();

  message.value = t(
    'All arenas reset — fresh start with a single empty arena',
    '所有 Arena 已重置 — 以单个空 Arena 重新开始',
  );
  clearLog();
}

function addArena() {
  const newArena: Arena = {
    id: arenaIdCounter++,
    capacity: ARENA_CAPACITY,
    pointer: 0,
    allocations: [],
  };
  arenas.value = [...arenas.value, newArena];
  activeArenaIndex.value = arenas.value.length - 1;

  history.push({
    action: 'new-arena',
    arenaId: newArena.id,
    timestamp: Date.now(),
  });

  message.value = t(
    `New Arena #${newArena.id} created (chained). When one arena fills up, chain a new one — like Go's arena allocator or Rust's bumpalo crate.`,
    `新 Arena #${newArena.id} 已创建（链式）。当一个 arena 满时，链接新的 — 类似 Go 的 arena 分配器或 Rust 的 bumpalo crate。`,
  );
  log(message.value, 'success');
  vizHistory.commit(
    { arenas: arenas.value, activeArenaIndex: activeArenaIndex.value },
    `new arena #${newArena.id}`,
  );
}

function slotAllocation(arena: Arena, index: number): Allocation | null {
  return arena.allocations.find((a) => index >= a.offset && index < a.offset + a.size) || null;
}

function isFirstCellOfAlloc(arena: Arena, index: number): Allocation | null {
  return arena.allocations.find((a) => a.offset === index) || null;
}

function usagePercent(arena: Arena): number {
  return Math.round((arena.pointer / arena.capacity) * 100);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function presetFillAndChain() {
  if (presetRunning) return;
  resetAll();
  presetRunning = true;
  message.value = t(
    'Filling an arena to capacity, then chaining a new one. LLVM does this for AST nodes — each compilation phase gets its own arena, freed atomically when done.',
    '将 arena 填满，然后链接新的。LLVM 对 AST 节点这样做 — 每个编译阶段有自己的 arena，完成后原子释放。',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  selectedSize.value = 4;
  for (let i = 0; i < 8; i++) {
    if (!presetRunning || isAborted()) return;
    allocate();
    await delay(300);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Arena full (32/32)! Adding a chained arena...',
    'Arena 已满 (32/32)！添加链式 arena...',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;
  addArena();
  await delay(400);
  if (!presetRunning || isAborted()) return;
  selectedSize.value = 2;
  allocate();
  await delay(300);
  if (!presetRunning || isAborted()) return;
  allocate();
  message.value = t(
    'Chained arena working. When both phases are done, reset both arenas in O(1) each — no per-object cleanup.',
    '链式 arena 正常工作。当两个阶段完成时，每个 arena O(1) 重置 — 无需逐对象清理。',
  );
  log(message.value, 'success');
  log(
    t(
      'Arena chaining enables unlimited allocation while preserving O(1) per-arena reset.',
      'Arena 链式分配支持无限制分配，同时保持每个 arena O(1) 重置。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetCompilerPhase() {
  if (presetRunning) return;
  resetAll();
  presetRunning = true;
  message.value = t(
    'Compiler phase simulation: allocate AST nodes for parsing, then reset the entire arena when done. This is how Zig, Rust (rustc), and Go compilers manage memory.',
    '编译器阶段模拟：为解析分配 AST 节点，完成后重置整个 arena。Zig、Rust (rustc) 和 Go 编译器就是这样管理内存的。',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  const nodeNames = ['FnDecl', 'Param', 'Block', 'Return', 'Expr', 'Ident', 'Literal'];
  const sizes = [4, 1, 2, 2, 1, 1, 1];
  for (let i = 0; i < nodeNames.length; i++) {
    if (!presetRunning || isAborted()) return;
    customLabel.value = nodeNames[i];
    selectedSize.value = sizes[i];
    allocate();
    await delay(350);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'Parse phase complete — 7 AST nodes allocated. Now resetting the arena. In a real compiler, this frees hundreds of thousands of nodes instantly.',
    '解析阶段完成 — 7 个 AST 节点已分配。现在重置 arena。在真实编译器中，这会瞬间释放数十万个节点。',
  );
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  resetArena(0);
  log(
    t(
      'Arena-per-phase frees hundreds of thousands of objects in a single pointer reset.',
      '每阶段 Arena 通过一次指针重置释放数十万个对象。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetMixedSizes() {
  if (presetRunning) return;
  resetAll();
  presetRunning = true;
  message.value = t(
    'Mixed allocation sizes: unlike malloc, arena allocation has zero internal fragmentation — each object is placed contiguously after the last.',
    '混合分配大小：与 malloc 不同，arena 分配零内部碎片 — 每个对象连续放置在上一个之后。',
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  const pattern = [1, 4, 2, 1, 4, 2, 1, 1, 2, 4];
  for (const size of pattern) {
    if (!presetRunning || isAborted()) return;
    selectedSize.value = size;
    allocate();
    await delay(300);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    `${totalAllocations.value} allocations, ${totalUsed.value}/${totalCapacity.value} used. Zero fragmentation — every byte is utilized. malloc would have metadata overhead per allocation (16-32 bytes each on 64-bit).`,
    `${totalAllocations.value} 次分配，${totalUsed.value}/${totalCapacity.value} 已使用。零碎片 — 每个字节都被利用。malloc 每次分配会有元数据开销（64 位系统每次 16-32 字节）。`,
  );
  log(message.value, 'highlight');
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Arena Allocator', '交互式 Arena 分配器') }}</div>

    <!-- Global Stats -->
    <div class="arena-stats">
      <div class="arena-stat">
        <span class="arena-stat-value arena-stat--primary">{{ totalUsed }}</span>
        <span class="viz-label">{{ t('Used', '已使用') }}</span>
      </div>
      <div class="arena-stat">
        <span class="arena-stat-value arena-stat--success">{{ totalCapacity - totalUsed }}</span>
        <span class="viz-label">{{ t('Free', '空闲') }}</span>
      </div>
      <div class="arena-stat">
        <span class="arena-stat-value">{{ totalCapacity }}</span>
        <span class="viz-label">{{ t('Total', '总计') }}</span>
      </div>
      <div class="arena-stat">
        <span class="arena-stat-value">{{ totalAllocations }}</span>
        <span class="viz-label">{{ t('Allocations', '分配次数') }}</span>
      </div>
      <div class="arena-stat">
        <span class="arena-stat-value">{{ arenas.length }}</span>
        <span class="viz-label">{{ t('Arenas', 'Arena 数') }}</span>
      </div>
    </div>

    <!-- Allocation Controls -->
    <div class="arena-alloc-controls">
      <div class="arena-size-row">
        <span class="viz-label">{{ t('Size:', '大小:') }}</span>
        <button
          v-for="opt in SIZE_OPTIONS"
          :key="opt.value"
          class="arena-size-btn"
          :class="{ 'arena-size-btn--active': selectedSize === opt.value }"
          @click="selectedSize = opt.value"
        >
          {{ opt.label() }}
        </button>
      </div>
      <div class="arena-label-row">
        <span class="viz-label">{{ t('Label:', '标签:') }}</span>
        <input
          v-model="customLabel"
          class="arena-label-input"
          :placeholder="t(`auto: obj${globalAllocId}`, `自动: obj${globalAllocId}`)"
          maxlength="12"
          @keyup.enter="allocate"
        />
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="allocate">
        {{ t('Allocate', '分配') }}
      </button>
      <button class="viz-btn" @click="addArena">
        {{ t('+ New Arena', '+ 新 Arena') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="resetAll">
        {{ t('Reset All', '全部重置') }}
      </button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetFillAndChain">
        {{ t('Fill & Chain', '填满链接') }}
      </button>
      <button class="viz-btn" @click="presetCompilerPhase">
        {{ t('Compiler Phase', '编译阶段') }}
      </button>
      <button class="viz-btn" @click="presetMixedSizes">{{ t('Mixed Sizes', '混合大小') }}</button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="vizHistory" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />

    <!-- Arena Tabs -->
    <div v-if="arenas.length > 1" class="arena-tabs">
      <button
        v-for="(arena, idx) in arenas"
        :key="arena.id"
        class="arena-tab"
        :class="{ 'arena-tab--active': activeArenaIndex === idx }"
        @click="activeArenaIndex = idx"
      >
        {{ t(`Arena #${arena.id}`, `Arena #${arena.id}`) }}
        <span class="arena-tab-usage">{{ usagePercent(arena) }}%</span>
      </button>
    </div>

    <!-- Arena Visualizations -->
    <div
      v-for="(arena, arenaIdx) in arenas"
      :key="arena.id"
      class="arena-block"
      :class="{ 'arena-block--active': activeArenaIndex === arenaIdx }"
    >
      <div class="arena-block-header">
        <span class="arena-block-title">
          {{ t(`Arena #${arena.id}`, `Arena #${arena.id}`) }}
          <span v-if="arenaIdx > 0" class="arena-chain-badge">
            {{ t('chained', '链式') }}
          </span>
        </span>
        <span class="arena-block-usage">
          {{ arena.pointer }}/{{ arena.capacity }} ({{ usagePercent(arena) }}%)
        </span>
        <button
          class="arena-reset-btn"
          @click="resetArena(arenaIdx)"
          :title="t('Reset this arena', '重置此 Arena')"
        >
          {{ t('Reset', '重置') }}
        </button>
      </div>

      <!-- Progress bar -->
      <div class="arena-progress">
        <div
          class="arena-progress-fill"
          :style="{ width: usagePercent(arena) + '%' }"
          :class="{
            'arena-progress--warning': usagePercent(arena) >= 75 && usagePercent(arena) < 100,
            'arena-progress--full': usagePercent(arena) >= 100,
          }"
        ></div>
      </div>

      <!-- Memory bar -->
      <div class="arena-bar-wrap">
        <div class="arena-bar">
          <template v-for="i in arena.capacity" :key="i - 1">
            <div
              class="arena-cell"
              :class="{
                'arena-cell--pointer': i - 1 === arena.pointer && arena.pointer < arena.capacity,
                'arena-cell--filled': slotAllocation(arena, i - 1) !== null,
                'arena-cell--alloc-start': isFirstCellOfAlloc(arena, i - 1) !== null,
              }"
              :style="
                slotAllocation(arena, i - 1)
                  ? { background: slotAllocation(arena, i - 1)!.color }
                  : {}
              "
              :title="
                slotAllocation(arena, i - 1)
                  ? `${slotAllocation(arena, i - 1)!.label} [${slotAllocation(arena, i - 1)!.offset}..${slotAllocation(arena, i - 1)!.offset + slotAllocation(arena, i - 1)!.size - 1}]`
                  : t(`Free (offset ${i - 1})`, `空闲 (偏移量 ${i - 1})`)
              "
            >
              <span
                v-if="
                  isFirstCellOfAlloc(arena, i - 1) && isFirstCellOfAlloc(arena, i - 1)!.size >= 2
                "
                class="arena-cell-label"
                >{{ isFirstCellOfAlloc(arena, i - 1)!.label }}</span
              >
            </div>
          </template>
        </div>

        <!-- Pointer indicator -->
        <div class="arena-pointer-track">
          <div
            class="arena-pointer-marker"
            :style="{ left: (arena.pointer / arena.capacity) * 100 + '%' }"
          >
            <div class="arena-pointer-arrow"></div>
            <div class="arena-pointer-label">ptr={{ arena.pointer }}</div>
          </div>
        </div>
      </div>

      <!-- Allocation legend for this arena -->
      <div v-if="arena.allocations.length > 0" class="arena-legend">
        <div v-for="alloc in arena.allocations" :key="alloc.id" class="arena-legend-item">
          <span class="arena-legend-swatch" :style="{ background: alloc.color }"></span>
          <span class="arena-legend-text">
            {{ alloc.label }} ({{ alloc.size }}) @{{ alloc.offset }}
          </span>
        </div>
      </div>
    </div>

    <!-- Allocation History -->
    <div v-if="history.length > 0" class="arena-history">
      <div class="arena-history-title">
        {{ t('Allocation History', '分配历史') }}
      </div>
      <div class="arena-history-list">
        <div
          v-for="(entry, idx) in [...history].reverse()"
          :key="idx"
          class="arena-history-entry"
          :class="`arena-history--${entry.action}`"
        >
          <span class="arena-history-time">{{ formatTime(entry.timestamp) }}</span>
          <span v-if="entry.action === 'alloc'" class="arena-history-desc">
            <span class="arena-history-badge arena-history-badge--alloc">ALLOC</span>
            "{{ entry.label }}"
            {{
              t(
                `${entry.size} unit(s) at offset ${entry.offset}`,
                `${entry.size} 个单元在偏移量 ${entry.offset}`,
              )
            }}
            <span class="arena-history-arena">Arena #{{ entry.arenaId }}</span>
          </span>
          <span v-else-if="entry.action === 'reset'" class="arena-history-desc">
            <span class="arena-history-badge arena-history-badge--reset">RESET</span>
            {{ t(`Arena #${entry.arenaId} freed`, `Arena #${entry.arenaId} 已释放`) }}
          </span>
          <span v-else-if="entry.action === 'new-arena'" class="arena-history-desc">
            <span class="arena-history-badge arena-history-badge--new">NEW</span>
            {{ t(`Arena #${entry.arenaId} created`, `Arena #${entry.arenaId} 已创建`) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- Allocation Controls --- */
.arena-alloc-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg-soft);
}

.arena-size-row,
.arena-label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.arena-size-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  font-family: var(--vp-font-family-base);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.arena-size-btn:hover {
  border-color: var(--viz-primary);
  color: var(--viz-primary);
}

.arena-size-btn--active {
  background: var(--viz-primary);
  color: #fff;
  border-color: var(--viz-primary);
}

.arena-label-input {
  flex: 1;
  min-width: 100px;
  max-width: 180px;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.2s;
}

.arena-label-input:focus {
  border-color: var(--viz-primary);
}

.arena-label-input::placeholder {
  color: var(--viz-muted);
}

/* --- Stats --- */
.arena-stats {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.arena-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 48px;
}

.arena-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.arena-stat--primary {
  color: var(--viz-primary);
}

.arena-stat--success {
  color: var(--viz-success);
}

/* --- Arena Tabs --- */
.arena-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.arena-tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--viz-border);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: var(--vp-c-bg-soft);
  color: var(--viz-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.arena-tab:hover {
  color: var(--viz-text);
}

.arena-tab--active {
  background: var(--vp-c-bg);
  color: var(--viz-primary);
  border-color: var(--viz-primary);
  font-weight: 600;
}

.arena-tab-usage {
  font-size: 0.625rem;
  opacity: 0.7;
}

/* --- Arena Block --- */
.arena-block {
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: var(--vp-c-bg);
  transition: border-color 0.2s;
}

.arena-block--active {
  border-color: var(--viz-primary);
  box-shadow: 0 0 0 1px var(--viz-primary);
}

.arena-block-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
  flex-wrap: wrap;
}

.arena-block-title {
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--viz-text);
}

.arena-chain-badge {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  font-size: 0.6rem;
  font-weight: 500;
  border-radius: var(--viz-radius-sm);
  background: var(--viz-warning);
  color: #fff;
  vertical-align: middle;
  margin-left: 0.25rem;
}

.arena-block-usage {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  color: var(--viz-muted);
  margin-left: auto;
}

.arena-reset-btn {
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  background: transparent;
  color: var(--viz-muted);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}

.arena-reset-btn:hover {
  border-color: var(--viz-danger);
  color: var(--viz-danger);
}

/* --- Progress Bar --- */
.arena-progress {
  height: 4px;
  background: var(--vp-c-bg-soft);
  border-radius: 2px;
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.arena-progress-fill {
  height: 100%;
  background: var(--viz-primary);
  border-radius: 2px;
  transition: width var(--viz-transition);
}

.arena-progress--warning {
  background: var(--viz-warning);
}

.arena-progress--full {
  background: var(--viz-danger);
}

/* --- Memory Bar --- */
.arena-bar-wrap {
  position: relative;
  margin-bottom: 0.5rem;
}

.arena-bar {
  display: flex;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  overflow: hidden;
  height: 36px;
}

.arena-cell {
  flex: 1;
  background: var(--viz-cell-empty);
  border-right: 1px solid var(--viz-border);
  transition: background var(--viz-transition);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.arena-cell:last-child {
  border-right: none;
}

.arena-cell--filled {
  animation: arena-fill 0.3s ease;
}

.arena-cell--alloc-start {
  border-left: 2px solid rgb(255 255 255 / 40%);
}

.arena-cell-label {
  font-size: 0.5rem;
  font-family: var(--vp-font-family-mono);
  color: #fff;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  text-shadow: 0 1px 2px rgb(0 0 0 / 40%);
  pointer-events: none;
  max-width: 100%;
  padding: 0 1px;
}

.arena-pointer-track {
  position: relative;
  height: 28px;
  margin-top: 2px;
}

.arena-pointer-marker {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: left var(--viz-transition);
}

.arena-pointer-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 6px solid var(--viz-danger);
}

.arena-pointer-label {
  font-size: 0.625rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-danger);
  white-space: nowrap;
}

/* --- Legend --- */
.arena-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.25rem;
}

.arena-legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.arena-legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.arena-legend-text {
  font-size: 0.625rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

/* --- Allocation History --- */
.arena-history {
  margin-top: 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: var(--viz-radius-sm);
  overflow: hidden;
}

.arena-history-title {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--vp-c-bg-soft);
  color: var(--viz-text);
  border-bottom: 1px solid var(--viz-border);
}

.arena-history-list {
  max-height: 180px;
  overflow-y: auto;
}

.arena-history-entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.7rem;
  border-bottom: 1px solid var(--viz-border);
}

.arena-history-entry:last-child {
  border-bottom: none;
}

.arena-history-time {
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  flex-shrink: 0;
  font-size: 0.65rem;
}

.arena-history-desc {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.arena-history-badge {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  font-size: 0.575rem;
  font-weight: 700;
  border-radius: var(--viz-radius-sm);
  color: #fff;
  letter-spacing: 0.025em;
  flex-shrink: 0;
}

.arena-history-badge--alloc {
  background: var(--viz-primary);
}

.arena-history-badge--reset {
  background: var(--viz-danger);
}

.arena-history-badge--new {
  background: var(--viz-success);
}

.arena-history-arena {
  font-size: 0.6rem;
  color: var(--viz-muted);
}

@keyframes arena-fill {
  from {
    opacity: 0;
    transform: scaleY(0.5);
  }

  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

/* --- Mobile --- */
@media (width <= 640px) {
  .arena-bar {
    height: 28px;
  }

  .arena-cell-label {
    display: none;
  }

  .arena-alloc-controls {
    padding: 0.5rem;
  }

  .arena-size-btn {
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
  }

  .arena-label-input {
    max-width: 140px;
    font-size: 0.7rem;
  }

  .arena-stats {
    gap: 0.5rem;
  }

  .arena-stat-value {
    font-size: 1rem;
  }

  .arena-history-entry {
    font-size: 0.625rem;
    padding: 0.25rem 0.5rem;
  }

  .arena-history-time {
    font-size: 0.575rem;
  }

  .arena-block {
    padding: 0.5rem;
  }

  .arena-block-header {
    gap: 0.25rem;
  }
}
</style>
