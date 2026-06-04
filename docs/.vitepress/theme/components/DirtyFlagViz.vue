<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();

interface Entity {
  id: number;
  name: string;
  x: number;
  y: number;
  dirty: boolean;
  lastComputed: string;
}

let nextId = 1;

const entities = ref<Entity[]>([
  { id: nextId++, name: 'Player', x: 100, y: 80, dirty: false, lastComputed: '(100,80)' },
  { id: nextId++, name: 'Enemy', x: 200, y: 60, dirty: false, lastComputed: '(200,60)' },
  { id: nextId++, name: 'NPC', x: 300, y: 100, dirty: false, lastComputed: '(300,100)' },
]);

const message = ref(t(
  'Move entities to mark them dirty, then recompute only what changed — used by React, Unity, and every game engine',
  '移动实体标记为脏，然后仅重新计算变更部分 — React、Unity 和所有游戏引擎都使用此模式'
));
const recomputeCount = ref(0);
const skipCount = ref(0);
let presetRunning = false;

function moveEntity(idx: number) {
  const e = entities.value[idx];
  e.x = Math.round(50 + Math.random() * 280);
  e.y = Math.round(30 + Math.random() * 100);
  e.dirty = true;
  message.value = t(
    `${e.name} moved to (${e.x},${e.y}) — marked DIRTY. Only this entity needs recomputation, not all ${entities.value.length}.`,
    `${e.name} 移动到 (${e.x},${e.y}) - 标记为脏。只有这个实体需要重算，而非全部 ${entities.value.length} 个。`
  );
}

function recompute() {
  let computed = 0;
  let skipped = 0;

  for (const e of entities.value) {
    if (e.dirty) {
      e.lastComputed = `(${e.x},${e.y})`;
      e.dirty = false;
      computed++;
    } else {
      skipped++;
    }
  }

  recomputeCount.value += computed;
  skipCount.value += skipped;
  message.value = t(
    `Recomputed: ${computed} dirty | Skipped: ${skipped} clean — total saved: ${skipCount.value}. This is how React.memo and shouldComponentUpdate work.`,
    `已重算: ${computed} 个脏 | 跳过: ${skipped} 个干净 - 累计节省: ${skipCount.value}。React.memo 和 shouldComponentUpdate 就是这样工作的。`
  );
}

function recomputeAll() {
  for (const e of entities.value) {
    e.lastComputed = `(${e.x},${e.y})`;
    e.dirty = false;
  }
  recomputeCount.value += entities.value.length;
  message.value = t(
    `Recomputed ALL ${entities.value.length} entities (no dirty flag optimization) — this is the naive approach that dirty flags avoid.`,
    `重算全部 ${entities.value.length} 个实体（无 Dirty Flag 优化）— 这是脏标记要避免的朴素方法。`
  );
}

function reset() {
  clearAll();
  nextId = 1;
  entities.value = [
    { id: nextId++, name: 'Player', x: 100, y: 80, dirty: false, lastComputed: '(100,80)' },
    { id: nextId++, name: 'Enemy', x: 200, y: 60, dirty: false, lastComputed: '(200,60)' },
    { id: nextId++, name: 'NPC', x: 300, y: 100, dirty: false, lastComputed: '(300,100)' },
  ];
  recomputeCount.value = 0;
  skipCount.value = 0;
  presetRunning = false;
  message.value = t('Reset — move entities and recompute', '已重置 - 移动实体并重新计算');
}

const dirtyCount = computed(() => entities.value.filter(e => e.dirty).length);

async function presetSelectiveUpdate() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Selective update: move 1 of 3 entities, then recompute. Only the dirty entity gets recalculated — React\'s reconciler does exactly this with fiber dirty flags.',
    '选择性更新：移动 3 个实体中的 1 个，然后重算。只有脏实体被重新计算 — React 的协调器用 fiber 脏标记做同样的事。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  moveEntity(0);
  await delay(600);
  if (!presetRunning || isAborted()) return;
  recompute();
  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Result: 1 recomputed, 2 skipped. In a scene with 10,000 objects, dirty flags turn O(n) into O(k) where k = changed count.',
    '结果：1 个重算，2 个跳过。在有 10,000 个对象的场景中，脏标记将 O(n) 变为 O(k)，k = 变更数量。'
  );
  presetRunning = false;
}

async function presetBatchVsNaive() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Batch vs naive: move all 3 entities, then compare dirty-only vs recompute-all. Unity\'s transform system batches dirty transforms before physics step.',
    '批量 vs 朴素：移动全部 3 个实体，然后比较仅脏数据 vs 全部重算。Unity 的变换系统在物理步骤前批量处理脏变换。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  for (let i = 0; i < entities.value.length; i++) {
    moveEntity(i);
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }
  message.value = t(
    'All dirty — recomputing with dirty flags processes all 3, same as naive. Dirty flags shine when only a subset changes.',
    '全部为脏 — 使用脏标记处理全部 3 个，与朴素方法相同。脏标记在只有子集变更时才发挥优势。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  recompute();
  presetRunning = false;
}

async function presetCascadingDirty() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Cascading dirty: move Player, recompute, move again, recompute. Shows how dirty flags handle rapid successive changes — CSS layout invalidation works this way.',
    '级联脏标记：移动 Player，重算，再次移动，重算。展示脏标记如何处理快速连续变更 — CSS 布局失效就是这样工作的。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  moveEntity(0);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  recompute();
  await delay(600);
  if (!presetRunning || isAborted()) return;
  moveEntity(0);
  moveEntity(1);
  await delay(500);
  if (!presetRunning || isAborted()) return;
  recompute();
  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Two rounds: 1 + 2 = 3 recomputed, 2 + 1 = 3 skipped. Each cycle only processes what changed since last recompute.',
    '两轮：1 + 2 = 3 个重算，2 + 1 = 3 个跳过。每轮只处理自上次重算以来变更的内容。'
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Dirty Flag', '交互式 Dirty Flag') }}</div>

    <svg viewBox="0 0 380 150" class="df-svg">
      <g v-for="(e, i) in entities" :key="e.id">
        <circle
          :cx="e.x"
          :cy="e.y"
          r="20"
          :fill="e.dirty ? 'var(--viz-warning)' : 'var(--viz-success)'"
          stroke="#fff"
          stroke-width="2"
          style="cursor: pointer; transition: all 0.3s"
          @click="moveEntity(i)"
        />
        <text
          :x="e.x"
          :y="e.y - 1"
          text-anchor="middle"
          dominant-baseline="central"
          fill="#fff"
          font-size="10"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
          style="pointer-events: none"
        >{{ e.name }}</text>
        <text
          v-if="e.dirty"
          :x="e.x + 16"
          :y="e.y - 16"
          fill="var(--viz-danger)"
          font-size="12"
          font-weight="700"
        >*</text>
        <text
          :x="e.x"
          :y="e.y + 30"
          text-anchor="middle"
          fill="var(--viz-muted)"
          font-size="8"
          font-family="var(--vp-font-family-mono)"
        >{{ t('cached:', '缓存:') }} {{ e.lastComputed }}</text>
      </g>
    </svg>

    <div class="df-stats">
      <span class="df-stat">{{ t('Dirty:', '脏:') }} <strong :style="{ color: dirtyCount > 0 ? 'var(--viz-warning)' : 'var(--viz-success)' }">{{ dirtyCount }}</strong></span>
      <span class="df-stat">{{ t('Recomputed:', '已重算:') }} <strong>{{ recomputeCount }}</strong></span>
      <span class="df-stat">{{ t('Skipped:', '已跳过:') }} <strong style="color: var(--viz-success)">{{ skipCount }}</strong></span>
    </div>

    <div class="df-hint">{{ t('Click entities to move them (marks dirty)', '点击实体移动它们（标记为脏）') }}</div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="recompute">{{ t('Recompute (dirty only)', '重算（仅脏数据）') }}</button>
      <button class="viz-btn" @click="recomputeAll">{{ t('Recompute ALL (no optimization)', '重算全部（无优化）') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetSelectiveUpdate">{{ t('Selective Update', '选择性更新') }}</button>
      <button class="viz-btn" @click="presetBatchVsNaive">{{ t('All Dirty', '全部脏') }}</button>
      <button class="viz-btn" @click="presetCascadingDirty">{{ t('Cascading', '级联') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.df-svg {
  width: 100%;
  max-width: 400px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 120px;
  background: var(--viz-cell-empty);
  border-radius: 8px;
}

.df-stats {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  flex-wrap: wrap;
  justify-content: center;
}

.df-stat {
  font-size: 0.75rem;
  color: var(--viz-text);
  font-family: var(--vp-font-family-mono);
}

.df-hint {
  font-size: 0.65rem;
  color: var(--viz-muted);
  text-align: center;
}
</style>
