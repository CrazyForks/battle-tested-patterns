<script setup lang="ts">
import { ref, computed } from 'vue';

interface DiffLine {
  type: 'keep' | 'add' | 'del';
  text: string;
}

const originalLines = ref<string[]>([
  'function greet(name) {',
  '  console.log("Hello, " + name);',
  '  return true;',
  '}',
]);

const modifiedLines = ref<string[]>([...originalLines.value]);
const diffResult = ref<DiffLine[]>([]);
const message = ref('Click "Modify" to make random edits, then "Diff" to compare');
const hasDiff = ref(false);
const patched = ref(false);

const insertions = [
  '  // validate input',
  '  if (!name) throw new Error("missing");',
  '  const ts = Date.now();',
  '  logger.info("called greet");',
  '  name = name.trim();',
];

const replacements = [
  'function greet(user) {',
  '  console.warn("Hi, " + name);',
  '  return false;',
  '  console.log(`Hello, ${name}!`);',
  'function sayHello(name) {',
];

function modify() {
  const lines = [...originalLines.value];
  const ops = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < ops; i++) {
    const action = Math.random();
    if (action < 0.33 && lines.length > 1) {
      const idx = Math.floor(Math.random() * lines.length);
      lines.splice(idx, 1);
    } else if (action < 0.66) {
      const idx = Math.floor(Math.random() * (lines.length + 1));
      const ins = insertions[Math.floor(Math.random() * insertions.length)];
      lines.splice(idx, 0, ins);
    } else {
      const idx = Math.floor(Math.random() * lines.length);
      const rep = replacements[Math.floor(Math.random() * replacements.length)];
      lines[idx] = rep;
    }
  }
  modifiedLines.value = lines;
  diffResult.value = [];
  hasDiff.value = false;
  patched.value = false;
  message.value = 'Modified panel updated — click "Diff" to see changes';
}

function computeDiff() {
  const a = originalLines.value;
  const b = modifiedLines.value;
  const result: DiffLine[] = [];

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ type: 'keep', text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', text: b[j - 1] });
      j--;
    } else {
      stack.push({ type: 'del', text: a[i - 1] });
      i--;
    }
  }

  stack.reverse();
  diffResult.value = stack;
  hasDiff.value = true;

  const adds = stack.filter(l => l.type === 'add').length;
  const dels = stack.filter(l => l.type === 'del').length;
  message.value = `Diff computed: +${adds} additions, -${dels} deletions`;
}

function patch() {
  if (!hasDiff.value) {
    message.value = 'Generate a diff first';
    return;
  }
  originalLines.value = [...modifiedLines.value];
  patched.value = true;
  message.value = 'Patch applied — original now matches modified';
}

function reset() {
  originalLines.value = [
    'function greet(name) {',
    '  console.log("Hello, " + name);',
    '  return true;',
    '}',
  ];
  modifiedLines.value = [...originalLines.value];
  diffResult.value = [];
  hasDiff.value = false;
  patched.value = false;
  message.value = 'Reset to initial state';
}

const diffPrefix = (type: string) => {
  if (type === 'add') return '+';
  if (type === 'del') return '-';
  return ' ';
};
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">Interactive Diff &amp; Patch</div>

    <div class="dp-panels">
      <div class="dp-panel">
        <div class="dp-panel-header">Original</div>
        <div class="dp-panel-body">
          <div v-for="(line, i) in originalLines" :key="'o-' + i" class="dp-line">
            <span class="dp-line-num">{{ i + 1 }}</span>
            <span class="dp-line-text">{{ line }}</span>
          </div>
          <div v-if="originalLines.length === 0" class="dp-empty">
            (empty)
          </div>
        </div>
      </div>

      <div class="dp-panel">
        <div class="dp-panel-header">Modified</div>
        <div class="dp-panel-body">
          <div v-for="(line, i) in modifiedLines" :key="'m-' + i" class="dp-line">
            <span class="dp-line-num">{{ i + 1 }}</span>
            <span class="dp-line-text">{{ line }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="diffResult.length > 0" class="dp-diff">
      <div class="dp-panel-header">Diff Output</div>
      <div class="dp-diff-body">
        <div
          v-for="(line, i) in diffResult"
          :key="'d-' + i"
          class="dp-diff-line"
          :class="{
            'dp-diff-line--add': line.type === 'add',
            'dp-diff-line--del': line.type === 'del',
          }"
        >
          <span class="dp-diff-prefix">{{ diffPrefix(line.type) }}</span>
          <span class="dp-diff-text">{{ line.text }}</span>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn" @click="modify">Modify</button>
      <button class="viz-btn viz-btn--primary" @click="computeDiff">Diff</button>
      <button class="viz-btn viz-btn--primary" :disabled="!hasDiff || patched" @click="patch">Patch</button>
      <button class="viz-btn viz-btn--danger" @click="reset">Reset</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.dp-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.dp-panel {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.dp-panel-header {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.375rem 0.625rem;
  background: var(--viz-border);
  color: var(--viz-text);
}

.dp-panel-body {
  padding: 0.375rem 0;
  max-height: 200px;
  overflow-y: auto;
}

.dp-line {
  display: flex;
  align-items: baseline;
  padding: 1px 0.625rem;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  line-height: 1.5;
}

.dp-line-num {
  width: 1.5rem;
  flex-shrink: 0;
  color: var(--viz-muted);
  text-align: right;
  margin-right: 0.5rem;
  user-select: none;
}

.dp-line-text {
  color: var(--viz-text);
  white-space: pre;
}

.dp-empty {
  padding: 0.5rem 0.625rem;
  color: var(--viz-muted);
  font-size: 0.75rem;
  font-style: italic;
}

.dp-diff {
  margin-top: 0.75rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.dp-diff-body {
  padding: 0.375rem 0;
  max-height: 220px;
  overflow-y: auto;
}

.dp-diff-line {
  display: flex;
  align-items: baseline;
  padding: 1px 0.625rem;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  line-height: 1.5;
}

.dp-diff-line--add {
  background: rgba(16, 185, 129, 0.12);
}

.dp-diff-line--del {
  background: rgba(239, 68, 68, 0.12);
}

.dp-diff-prefix {
  width: 1rem;
  flex-shrink: 0;
  font-weight: 700;
  margin-right: 0.375rem;
  user-select: none;
}

.dp-diff-line--add .dp-diff-prefix {
  color: var(--viz-success);
}

.dp-diff-line--del .dp-diff-prefix {
  color: var(--viz-danger);
}

.dp-diff-text {
  color: var(--viz-text);
  white-space: pre;
}

.viz-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .dp-panels {
    grid-template-columns: 1fr;
  }
}
</style>
