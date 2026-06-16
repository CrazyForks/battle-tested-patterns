<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

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
const message = ref(
  t(
    'Click "Modify" to make random edits, then "Diff" to compare — or pick a scenario below',
    '点击"修改"进行随机编辑，然后点击"Diff"进行对比 — 或选择下方场景',
  ),
);
const hasDiff = ref(false);
const patched = ref(false);
let presetRunning = false;

interface DPSnapshot {
  originalLines: string[];
  modifiedLines: string[];
  diffResult: DiffLine[];
  hasDiff: boolean;
  patched: boolean;
}

const history = useVizHistory<DPSnapshot>(
  {
    originalLines: originalLines.value,
    modifiedLines: modifiedLines.value,
    diffResult: diffResult.value,
    hasDiff: hasDiff.value,
    patched: patched.value,
  },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      originalLines.value = snap.originalLines;
      modifiedLines.value = snap.modifiedLines;
      diffResult.value = snap.diffResult;
      hasDiff.value = snap.hasDiff;
      patched.value = snap.patched;
      if (msg !== undefined) message.value = msg;
    },
  },
);

function commitSnapshot(label: string) {
  history.commit(
    {
      originalLines: originalLines.value,
      modifiedLines: modifiedLines.value,
      diffResult: diffResult.value,
      hasDiff: hasDiff.value,
      patched: patched.value,
    },
    label,
  );
}

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
  message.value = t(
    'Modified panel updated — click "Diff" to compute the LCS-based diff. This is the same algorithm git uses internally.',
    '修改面板已更新 — 点击"Diff"计算基于 LCS 的差异。这与 git 内部使用的算法相同。',
  );
  commitSnapshot('modify');
}

function computeDiff() {
  const a = originalLines.value;
  const b = modifiedLines.value;

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

  const adds = stack.filter((l) => l.type === 'add').length;
  const dels = stack.filter((l) => l.type === 'del').length;
  const keeps = stack.filter((l) => l.type === 'keep').length;
  message.value = t(
    `Diff computed via LCS (Longest Common Subsequence): +${adds} additions, -${dels} deletions, ${keeps} unchanged. Time complexity: O(m×n) where m=${m}, n=${n}.`,
    `通过 LCS（最长公共子序列）计算差异：+${adds} 新增，-${dels} 删除，${keeps} 未变。时间复杂度：O(m×n)，m=${m}，n=${n}。`,
  );
  log(message.value, 'success');
  commitSnapshot('computeDiff');
}

function patch() {
  if (!hasDiff.value) {
    message.value = t('Generate a diff first', '请先生成 Diff');
    return;
  }
  originalLines.value = [...modifiedLines.value];
  patched.value = true;
  message.value = t(
    'Patch applied — original now matches modified. In production, patches are transmitted instead of full files. Git stores deltas (packfiles) using this principle.',
    'Patch 已应用 — 原始文件已与修改后一致。生产环境中传输 patch 而非完整文件。Git 使用此原理存储增量（packfiles）。',
  );
  log(message.value, 'success');
  commitSnapshot('applyPatch');
}

function reset() {
  clearAll();
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
  presetRunning = false;
  message.value = t('Reset to initial state', '已重置为初始状态');
  clearLog();
  history.reset();
}

async function presetMinimalDiff() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Minimal change: renaming a parameter. The diff will show exactly 1 deletion + 1 addition. This is how code review tools highlight what actually changed.',
    '最小改动：重命名参数。差异将显示恰好 1 个删除 + 1 个添加。这就是代码审查工具高亮实际变更的方式。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  modifiedLines.value = [
    'function greet(user) {',
    '  console.log("Hello, " + name);',
    '  return true;',
    '}',
  ];
  commitSnapshot('preset: minimal change');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  computeDiff();
  log(
    t(
      'LCS-based diff finds the minimum edit distance — precisely what changed, nothing more.',
      '基于 LCS 的 diff 找到最小编辑距离 — 精确显示变更，不多不少。',
    ),
    'highlight',
  );
  presetRunning = false;
}

async function presetInsertBlock() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Inserting a validation block — the diff algorithm finds that existing lines are "kept" and new lines are "added". The LCS ensures minimum edit distance.',
    '插入验证代码块 — 差异算法发现现有行被"保留"而新行被"添加"。LCS 确保最小编辑距离。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  modifiedLines.value = [
    'function greet(name) {',
    '  if (!name) {',
    '    throw new Error("name required");',
    '  }',
    '  console.log("Hello, " + name);',
    '  return true;',
    '}',
  ];
  commitSnapshot('preset: insert block');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  computeDiff();
  await delay(1200);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Notice: 3 lines added, 0 deleted, 4 kept. The patch would be just 3 lines — much smaller than sending the whole file. This is why git push only transfers deltas.',
    '注意：3 行添加，0 行删除，4 行保留。补丁只有 3 行 — 比发送整个文件小得多。这就是 git push 只传输增量的原因。',
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetFullRewrite() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Complete rewrite — every line changes. The diff shows all original lines deleted and all new lines added. When the diff is larger than the file, git stores the whole file instead.',
    '完全重写 — 每行都改变。差异显示所有原始行被删除，所有新行被添加。当差异大于文件本身时，git 存储完整文件。',
  );
  await delay(800);
  if (!presetRunning || isAborted()) return;
  modifiedLines.value = [
    'const sayHello = (name: string) => {',
    '  const msg = `Hello, ${name}!`;',
    '  console.info(msg);',
    '  return msg;',
    '};',
  ];
  commitSnapshot('preset: full rewrite');
  await delay(600);
  if (!presetRunning || isAborted()) return;
  computeDiff();
  log(
    t(
      'When every line changes, diff equals full file size — git switches to storing the whole blob.',
      '当每行都变更时，diff 等于完整文件大小 — git 转为存储整个 blob。',
    ),
    'highlight',
  );
  presetRunning = false;
}

const diffPrefix = (type: string) => {
  if (type === 'add') return '+';
  if (type === 'del') return '-';
  return ' ';
};
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Diff & Patch', '交互式 Diff & Patch') }}</div>

    <div class="dp-panels">
      <div class="dp-panel">
        <div class="dp-panel-header">{{ t('Original', '原始') }}</div>
        <div class="dp-panel-body">
          <div v-for="(line, i) in originalLines" :key="'o-' + i" class="dp-line">
            <span class="dp-line-num">{{ i + 1 }}</span>
            <span class="dp-line-text">{{ line }}</span>
          </div>
          <div v-if="originalLines.length === 0" class="dp-empty">
            {{ t('(empty)', '（空）') }}
          </div>
        </div>
      </div>

      <div class="dp-panel">
        <div class="dp-panel-header">{{ t('Modified', '修改后') }}</div>
        <div class="dp-panel-body">
          <div v-for="(line, i) in modifiedLines" :key="'m-' + i" class="dp-line">
            <span class="dp-line-num">{{ i + 1 }}</span>
            <span class="dp-line-text">{{ line }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="diffResult.length > 0" class="dp-diff">
      <div class="dp-panel-header">{{ t('Diff Output', 'Diff 输出') }}</div>
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
      <button class="viz-btn" @click="modify">{{ t('Modify', '修改') }}</button>
      <button class="viz-btn viz-btn--primary" @click="computeDiff">{{ t('Diff', 'Diff') }}</button>
      <button class="viz-btn viz-btn--primary" :disabled="!hasDiff || patched" @click="patch">
        {{ t('Patch', 'Patch') }}
      </button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetMinimalDiff">
        {{ t('Minimal Change', '最小改动') }}
      </button>
      <button class="viz-btn" @click="presetInsertBlock">
        {{ t('Insert Block', '插入代码块') }}
      </button>
      <button class="viz-btn" @click="presetFullRewrite">
        {{ t('Full Rewrite', '完全重写') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
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
  border-radius: var(--viz-radius-sm);
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
  border-radius: var(--viz-radius-sm);
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
  background: rgb(16 185 129 / 12%);
}

.dp-diff-line--del {
  background: rgb(239 68 68 / 12%);
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

@media (width <= 640px) {
  .dp-panels {
    grid-template-columns: 1fr;
  }
}
</style>
