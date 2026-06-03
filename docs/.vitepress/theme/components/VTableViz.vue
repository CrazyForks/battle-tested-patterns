<script setup lang="ts">
import { ref, reactive } from 'vue';

interface VTableEntry {
  name: string;
  impl: string;
}

interface ClassDef {
  name: string;
  color: string;
  vtable: VTableEntry[];
}

interface ObjInstance {
  id: number;
  label: string;
  className: string;
}

const classes: ClassDef[] = [
  {
    name: 'Animal',
    color: 'var(--viz-muted)',
    vtable: [
      { name: 'speak()', impl: 'Animal::speak → "..."' },
      { name: 'move()', impl: 'Animal::move → "move"' },
    ],
  },
  {
    name: 'Cat',
    color: 'var(--viz-primary)',
    vtable: [
      { name: 'speak()', impl: 'Cat::speak → "meow!"' },
      { name: 'move()', impl: 'Cat::move → "slink"' },
    ],
  },
  {
    name: 'Dog',
    color: 'var(--viz-success)',
    vtable: [
      { name: 'speak()', impl: 'Dog::speak → "woof!"' },
      { name: 'move()', impl: 'Dog::move → "bound"' },
    ],
  },
];

const objects = reactive<ObjInstance[]>([
  { id: 0, label: 'cat1', className: 'Cat' },
  { id: 1, label: 'dog1', className: 'Dog' },
  { id: 2, label: 'cat2', className: 'Cat' },
]);

const dispatching = ref(false);
const activeObjId = ref(-1);
const activeClass = ref('');
const activeMethod = ref('');
const activeStep = ref(0); // 0=idle, 1=obj, 2=vptr, 3=vtable, 4=method
const dispatchResult = ref('');
const message = ref('Click an object and a method to see vtable dispatch');

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getClassDef(name: string): ClassDef {
  return classes.find(c => c.name === name)!;
}

function getClassColor(name: string): string {
  return getClassDef(name).color;
}

async function callMethod(obj: ObjInstance, methodName: string) {
  if (dispatching.value) return;
  dispatching.value = true;
  dispatchResult.value = '';

  const cls = getClassDef(obj.className);
  const entry = cls.vtable.find(e => e.name === methodName)!;

  // Step 1: highlight object
  activeObjId.value = obj.id;
  activeClass.value = '';
  activeMethod.value = '';
  activeStep.value = 1;
  message.value = `${obj.label}.${methodName} called — reading object's vptr...`;
  await delay(700);

  // Step 2: follow vptr to class
  activeClass.value = obj.className;
  activeStep.value = 2;
  message.value = `vptr points to ${obj.className}'s vtable`;
  await delay(700);

  // Step 3: look up method in vtable
  activeMethod.value = methodName;
  activeStep.value = 3;
  message.value = `Looking up ${methodName} in ${obj.className} vtable...`;
  await delay(700);

  // Step 4: dispatch result
  activeStep.value = 4;
  dispatchResult.value = entry.impl;
  message.value = `Dispatched: ${entry.impl}`;
  await delay(1200);

  // Reset
  activeObjId.value = -1;
  activeClass.value = '';
  activeMethod.value = '';
  activeStep.value = 0;
  dispatching.value = false;
}

function reset() {
  dispatching.value = false;
  activeObjId.value = -1;
  activeClass.value = '';
  activeMethod.value = '';
  activeStep.value = 0;
  dispatchResult.value = '';
  message.value = 'Click an object and a method to see vtable dispatch';
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive VTable Dispatch</div>

    <div class="vt-layout">
      <!-- Objects column -->
      <div class="vt-col">
        <div class="vt-col-label">Objects</div>
        <div
          v-for="obj in objects"
          :key="obj.id"
          class="vt-obj"
          :class="{
            'vt-obj-active': obj.id === activeObjId,
          }"
          :style="{ borderColor: obj.id === activeObjId ? getClassColor(obj.className) : undefined }"
        >
          <div class="vt-obj-name">{{ obj.label }}</div>
          <div class="vt-obj-type" :style="{ color: getClassColor(obj.className) }">
            : {{ obj.className }}
          </div>
          <div class="vt-obj-vptr">
            vptr
            <span class="vt-arrow" :class="{ 'vt-arrow-lit': obj.id === activeObjId && activeStep >= 2 }">
              &#x2192;
            </span>
          </div>
          <div class="vt-obj-btns">
            <button
              class="vt-call-btn"
              :disabled="dispatching"
              @click="callMethod(obj, 'speak()')"
            >speak()</button>
            <button
              class="vt-call-btn"
              :disabled="dispatching"
              @click="callMethod(obj, 'move()')"
            >move()</button>
          </div>
        </div>
      </div>

      <!-- Arrow column -->
      <div class="vt-arrow-col">
        <div
          v-for="obj in objects"
          :key="'arr-' + obj.id"
          class="vt-arrow-row"
        >
          <span
            class="vt-ptr-line"
            :class="{ 'vt-ptr-lit': obj.id === activeObjId && activeStep >= 2 }"
          >&#x2500;&#x2500;&#x25B6;</span>
        </div>
      </div>

      <!-- VTables column -->
      <div class="vt-col">
        <div class="vt-col-label">VTables</div>
        <div
          v-for="cls in classes.slice(1)"
          :key="cls.name"
          class="vt-vtable"
          :class="{ 'vt-vtable-active': cls.name === activeClass }"
          :style="{ borderColor: cls.name === activeClass ? cls.color : undefined }"
        >
          <div class="vt-vtable-header" :style="{ background: cls.color }">
            {{ cls.name }} vtable
          </div>
          <div
            v-for="entry in cls.vtable"
            :key="entry.name"
            class="vt-vtable-row"
            :class="{
              'vt-row-hit': cls.name === activeClass && entry.name === activeMethod && activeStep >= 3,
            }"
          >
            <span class="vt-method-name">{{ entry.name }}</span>
            <span class="vt-method-ptr">&#x2192;</span>
            <span class="vt-method-impl">{{ entry.impl.split(' → ')[0] }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Dispatch result -->
    <div v-if="dispatchResult" class="vt-result">
      <span class="vt-result-label">Result:</span>
      <span class="vt-result-value">{{ dispatchResult }}</span>
    </div>

    <!-- Dispatch chain diagram -->
    <div v-if="activeStep > 0" class="vt-chain">
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 1 }">
        object
      </span>
      <span class="vt-chain-arrow" :class="{ 'vt-step-active': activeStep >= 2 }">&#x2192;</span>
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 2 }">
        vptr
      </span>
      <span class="vt-chain-arrow" :class="{ 'vt-step-active': activeStep >= 3 }">&#x2192;</span>
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 3 }">
        vtable
      </span>
      <span class="vt-chain-arrow" :class="{ 'vt-step-active': activeStep >= 4 }">&#x2192;</span>
      <span class="vt-chain-step" :class="{ 'vt-step-active': activeStep >= 4 }">
        method
      </span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--danger" :disabled="dispatching" @click="reset">Reset</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.vt-layout {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 0;
  overflow-x: auto;
}

.vt-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.vt-col-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
  letter-spacing: 0.05em;
  padding-bottom: 2px;
}

/* --- Objects --- */
.vt-obj {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.45rem 0.6rem;
  border: 2px solid var(--viz-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 110px;
}

.vt-obj-active {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
}

.vt-obj-name {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.vt-obj-type {
  font-size: 0.7rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
}

.vt-obj-vptr {
  font-size: 0.65rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  margin-top: 2px;
}

.vt-arrow {
  transition: color 0.2s;
}

.vt-arrow-lit {
  color: var(--viz-warning);
  font-weight: 700;
}

.vt-obj-btns {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.vt-call-btn {
  padding: 2px 6px;
  border: 1px solid var(--viz-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  font-size: 0.65rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--viz-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.vt-call-btn:hover:not(:disabled) {
  background: var(--viz-primary);
  color: #fff;
  border-color: var(--viz-primary);
}

.vt-call-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* --- Arrow column --- */
.vt-arrow-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 22px;
  align-items: center;
}

.vt-arrow-row {
  display: flex;
  align-items: center;
  height: 88px;
}

.vt-ptr-line {
  font-size: 0.9rem;
  color: var(--viz-border);
  transition: color 0.2s;
  font-family: var(--vp-font-family-mono);
}

.vt-ptr-lit {
  color: var(--viz-warning);
  animation: vt-flash 0.5s ease;
}

/* --- VTables --- */
.vt-vtable {
  border: 2px solid var(--viz-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg);
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 160px;
}

.vt-vtable-active {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
}

.vt-vtable-header {
  padding: 0.3rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
  font-family: var(--vp-font-family-mono);
}

.vt-vtable-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.3rem 0.5rem;
  border-top: 1px solid var(--viz-border);
  font-size: 0.68rem;
  font-family: var(--vp-font-family-mono);
  transition: background 0.2s;
}

.vt-row-hit {
  background: var(--viz-warning);
  color: #fff;
}

.vt-row-hit .vt-method-name,
.vt-row-hit .vt-method-ptr,
.vt-row-hit .vt-method-impl {
  color: #fff;
}

.vt-method-name {
  font-weight: 700;
  color: var(--viz-text);
}

.vt-method-ptr {
  color: var(--viz-muted);
}

.vt-method-impl {
  color: var(--viz-primary);
  font-weight: 600;
}

/* --- Dispatch result --- */
.vt-result {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 0.7rem;
  margin: 0.5rem 0;
  border: 2px solid var(--viz-success);
  border-radius: 8px;
  background: var(--vp-c-bg);
  animation: vt-flash 0.4s ease;
}

.vt-result-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-success);
}

.vt-result-value {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

/* --- Dispatch chain --- */
.vt-chain {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.5rem 0;
  flex-wrap: wrap;
  justify-content: center;
}

.vt-chain-step {
  padding: 0.25rem 0.5rem;
  border: 2px solid var(--viz-border);
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  background: var(--vp-c-bg);
  transition: all 0.2s;
}

.vt-chain-arrow {
  font-size: 0.9rem;
  color: var(--viz-border);
  transition: color 0.2s;
}

.vt-step-active {
  color: var(--viz-warning);
  border-color: var(--viz-warning);
}

@keyframes vt-flash {
  0% { opacity: 0.4; }
  100% { opacity: 1; }
}

@media (max-width: 640px) {
  .vt-layout {
    flex-direction: column;
    align-items: stretch;
  }

  .vt-arrow-col {
    flex-direction: row;
    padding-top: 0;
    justify-content: center;
  }

  .vt-arrow-row {
    height: auto;
    transform: rotate(90deg);
  }
}
</style>
