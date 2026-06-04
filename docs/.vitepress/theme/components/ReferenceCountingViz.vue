<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';

const { t } = useI18n();
const { safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();

interface RCObject {
  id: number;
  name: string;
  refCount: number;
  freed: boolean;
}

interface Reference {
  from: string;
  toId: number;
  color: string;
}

let nextObjId = 1;
let presetRunning = false;

const objects = ref<RCObject[]>([
  { id: nextObjId++, name: 'Obj A', refCount: 2, freed: false },
  { id: nextObjId++, name: 'Obj B', refCount: 1, freed: false },
]);

const references = ref<Reference[]>([
  { from: 'var x', toId: 1, color: 'var(--viz-primary)' },
  { from: 'var y', toId: 1, color: 'var(--viz-success)' },
  { from: 'var z', toId: 2, color: 'var(--viz-warning)' },
]);

const message = ref(t(
  'Drop references to decrement ref counts. Objects are freed at rc=0 — this is how CPython, Objective-C ARC, and Rust\'s Rc<T>/Arc<T> manage memory',
  '删除引用以减少引用计数。rc=0 时对象将被释放 — CPython、Objective-C ARC 和 Rust 的 Rc<T>/Arc<T> 就是这样管理内存的'
));
const lastFreed = ref(-1);

function dropRef(refIdx: number) {
  const r = references.value[refIdx];
  const obj = objects.value.find(o => o.id === r.toId);
  if (!obj || obj.freed) return;

  references.value = references.value.filter((_, i) => i !== refIdx);
  obj.refCount--;

  if (obj.refCount <= 0) {
    obj.freed = true;
    lastFreed.value = obj.id;
    message.value = t(`Dropped ${r.from} → ${obj.name} — rc=0, FREED!`, `已删除 ${r.from} → ${obj.name} — rc=0，已释放！`);
    safeTimeout(() => { lastFreed.value = -1; }, 600);
  } else {
    message.value = t(`Dropped ${r.from} → ${obj.name} — rc=${obj.refCount}`, `已删除 ${r.from} → ${obj.name} — rc=${obj.refCount}`);
  }
}

function addRef(targetId?: number) {
  const liveObjs = objects.value.filter(o => !o.freed);
  if (liveObjs.length === 0) {
    message.value = t('No live objects to reference', '没有可引用的存活对象');
    return;
  }
  const target = targetId
    ? liveObjs.find(o => o.id === targetId) || liveObjs[0]
    : liveObjs[Math.floor(Math.random() * liveObjs.length)];
  const varName = `var ${String.fromCharCode(97 + references.value.length)}`;
  const colors = ['var(--viz-primary)', 'var(--viz-success)', 'var(--viz-warning)', 'var(--viz-danger)'];
  const color = colors[references.value.length % colors.length];

  references.value = [...references.value, { from: varName, toId: target.id, color }];
  target.refCount++;
  message.value = t(`Added ${varName} → ${target.name} — rc=${target.refCount}`, `已添加 ${varName} → ${target.name} — rc=${target.refCount}`);
}

function addObject() {
  if (objects.value.filter(o => !o.freed).length >= 5) {
    message.value = t('Maximum 5 live objects', '最多 5 个存活对象');
    return;
  }
  const obj: RCObject = { id: nextObjId++, name: `Obj ${String.fromCharCode(64 + nextObjId - 1)}`, refCount: 0, freed: false };
  objects.value = [...objects.value, obj];
  message.value = t(`Created ${obj.name} with rc=0 — add a reference or it stays unreachable`, `已创建 ${obj.name}，rc=0 — 添加引用否则将不可达`);
}

function reset() {
  clearAll();
  nextObjId = 1;
  presetRunning = false;
  objects.value = [
    { id: nextObjId++, name: 'Obj A', refCount: 2, freed: false },
    { id: nextObjId++, name: 'Obj B', refCount: 1, freed: false },
  ];
  references.value = [
    { from: 'var x', toId: 1, color: 'var(--viz-primary)' },
    { from: 'var y', toId: 1, color: 'var(--viz-success)' },
    { from: 'var z', toId: 2, color: 'var(--viz-warning)' },
  ];
  lastFreed.value = -1;
  message.value = t('Reset — drop references to see ref counting in action', '已重置 — 删除引用以查看引用计数的工作过程');
}

const liveCount = computed(() => objects.value.filter(o => !o.freed).length);
const freedCount = computed(() => objects.value.filter(o => o.freed).length);

async function presetDropAll() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Drop all refs: remove every reference one by one. Each drop decrements rc — when rc hits 0, the object is immediately freed. This is CPython\'s primary GC mechanism: no pause, deterministic deallocation.',
    '逐一删除：逐个移除所有引用。每次删除减少 rc — rc 到 0 时对象立即释放。这是 CPython 的主要 GC 机制：无暂停，确定性释放。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  while (references.value.length > 0) {
    if (!presetRunning || isAborted()) return;
    dropRef(0);
    await delay(500);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'All objects freed deterministically — no GC pause needed. CPython frees objects the instant rc=0. Compare with tracing GC (Java, Go): objects survive until the next mark-sweep cycle, causing latency spikes. The tradeoff: reference counting cannot detect cycles (A→B→A).',
    '所有对象确定性释放 — 无需 GC 暂停。CPython 在 rc=0 时立即释放。对比追踪式 GC (Java, Go)：对象存活到下一次标记-清除周期，导致延迟抖动。代价：引用计数无法检测循环引用 (A→B→A)。'
  );
  presetRunning = false;
}

async function presetSharedOwnership() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Shared ownership: multiple variables point to the same object, incrementing its rc. This is Rust\'s Rc<T> (single-thread) and Arc<T> (atomic, multi-thread) — the object lives until the last owner drops.',
    '共享所有权：多个变量指向同一对象，递增其 rc。这就是 Rust 的 Rc<T>（单线程）和 Arc<T>（原子，多线程）— 对象存活到最后一个所有者释放。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  addRef(1);
  await delay(400);
  if (!presetRunning || isAborted()) return;
  addRef(1);
  await delay(400);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'Obj A now has rc=4. Dropping one reference won\'t free it — 3 owners remain. Watch as we drop 3 refs, leaving it alive with rc=1.',
    'Obj A 现在 rc=4。删除一个引用不会释放它 — 还有 3 个所有者。观察我们删除 3 个引用，它仍以 rc=1 存活。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  for (let i = 0; i < 3; i++) {
    if (!presetRunning || isAborted()) return;
    const idx = references.value.findIndex(r => r.toId === 1);
    if (idx >= 0) dropRef(idx);
    await delay(500);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Obj A survives at rc=1 — the last owner keeps it alive. In Rust, Rc::strong_count() lets you inspect this. In Objective-C ARC, the compiler inserts retain/release calls automatically. Swift\'s ARC works the same way — every strong property is an rc increment.',
    'Obj A 以 rc=1 存活 — 最后一个所有者保持它存活。在 Rust 中，Rc::strong_count() 可以检查这个值。在 Objective-C ARC 中，编译器自动插入 retain/release 调用。Swift 的 ARC 也一样 — 每个 strong 属性都是一次 rc 递增。'
  );
  presetRunning = false;
}

async function presetDanglingZero() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Zero-rc danger: create an object with no references. It has rc=0 but is never freed — this is a memory leak. Reference counting only frees when rc *decrements* to 0, not when it starts at 0.',
    '零引用危险：创建没有引用的对象。它 rc=0 但永远不会被释放 — 这是内存泄漏。引用计数只在 rc *递减*到 0 时释放，而不是一开始就是 0。'
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;

  addObject();
  await delay(500);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    'New object sits at rc=0 — unreachable but not freed. Now drop all refs to the original objects. They get freed, but the orphan stays.',
    '新对象 rc=0 — 不可达但未释放。现在删除原始对象的所有引用。它们被释放了，但孤儿留下了。'
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  while (references.value.length > 0) {
    if (!presetRunning || isAborted()) return;
    dropRef(0);
    await delay(400);
  }
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Obj A and B freed, but the orphan object leaks! In CPython, the cyclic GC catches these. In C++ shared_ptr, you must ensure at least one shared_ptr is created — raw new without shared_ptr = leak. Weak references (weak_ptr, weakref) break cycles without incrementing rc.',
    'Obj A 和 B 已释放，但孤儿对象泄漏了！在 CPython 中，循环 GC 会捕获这些。在 C++ shared_ptr 中，必须确保至少创建一个 shared_ptr — 不用 shared_ptr 的 raw new = 泄漏。弱引用 (weak_ptr, weakref) 在不递增 rc 的情况下打破循环。'
  );
  presetRunning = false;
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Reference Counting', '交互式 Reference Counting') }}</div>

    <div class="rc-layout">
      <!-- References -->
      <div class="rc-refs">
        <div class="rc-section-title">{{ t('Variables', '变量') }}</div>
        <div
          v-for="(r, i) in references"
          :key="i"
          class="rc-ref"
          :style="{ borderColor: r.color }"
          @click="dropRef(i)"
        >
          <span class="rc-ref-name" :style="{ color: r.color }">{{ r.from }}</span>
          <span class="rc-ref-arrow">→</span>
          <span class="rc-ref-target">{{ objects.find(o => o.id === r.toId)?.name }}</span>
        </div>
        <div v-if="references.length === 0" class="rc-empty">{{ t('no references', '无引用') }}</div>
        <div class="rc-hint">{{ t('Click to drop', '点击删除') }}</div>
      </div>

      <!-- Objects -->
      <div class="rc-objects">
        <div class="rc-section-title">{{ t('Heap Objects', '堆对象') }}</div>
        <div
          v-for="obj in objects"
          :key="obj.id"
          class="rc-object"
          :class="{
            'rc-object-freed': obj.freed,
            'rc-object-freeing': lastFreed === obj.id,
          }"
        >
          <span class="rc-obj-name">{{ obj.name }}</span>
          <span class="rc-obj-rc" :class="{ 'rc-obj-rc-zero': obj.refCount <= 0 }">
            rc={{ obj.refCount }}
          </span>
          <span v-if="obj.freed" class="rc-freed-badge">{{ t('FREED', '已释放') }}</span>
        </div>
      </div>
    </div>

    <div class="rc-stats">
      <span class="rc-stat">{{ t('Live:', '存活：') }} <strong>{{ liveCount }}</strong></span>
      <span class="rc-stat">{{ t('Freed:', '已释放：') }} <strong style="color: var(--viz-danger)">{{ freedCount }}</strong></span>
      <span class="rc-stat">{{ t('Refs:', '引用：') }} <strong>{{ references.length }}</strong></span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="addRef()">{{ t('+ Reference', '+ 引用') }}</button>
      <button class="viz-btn" @click="addObject">{{ t('+ Object', '+ 对象') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetDropAll">{{ t('Drop All', '全部删除') }}</button>
      <button class="viz-btn" @click="presetSharedOwnership">{{ t('Shared Ownership', '共享所有权') }}</button>
      <button class="viz-btn" @click="presetDanglingZero">{{ t('Orphan Leak', '孤儿泄漏') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.rc-layout {
  display: flex;
  gap: 1rem;
  padding: 1rem 0;
}

@media (max-width: 640px) {
  .rc-layout { flex-direction: column; }
}

.rc-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  margin-bottom: 6px;
}

.rc-refs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.rc-ref {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 2px solid;
  border-radius: 6px;
  background: var(--vp-c-bg);
  cursor: pointer;
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  transition: all 0.15s;
}

.rc-ref:hover {
  opacity: 0.7;
  transform: scale(0.97);
}

.rc-ref-name {
  font-weight: 700;
}

.rc-ref-arrow {
  color: var(--viz-muted);
}

.rc-ref-target {
  color: var(--viz-text);
}

.rc-hint {
  font-size: 0.6rem;
  color: var(--viz-muted);
  font-style: italic;
  text-align: center;
}

.rc-objects {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rc-object {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  transition: all 0.3s;
}

.rc-object-freed {
  opacity: 0.3;
  background: rgba(239, 68, 68, 0.05);
  text-decoration: line-through;
}

.rc-object-freeing {
  animation: viz-pulse 0.5s ease;
}

.rc-obj-name {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.rc-obj-rc {
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
}

.rc-obj-rc-zero {
  color: var(--viz-danger);
  font-weight: 700;
}

.rc-freed-badge {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--viz-danger);
  margin-left: auto;
}

.rc-empty {
  font-size: 0.7rem;
  color: var(--viz-muted);
  font-style: italic;
}

.rc-stats {
  display: flex;
  gap: 1rem;
  padding: 0.3rem 0;
  justify-content: center;
}

.rc-stat {
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}
</style>
