<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
let aborted = false;
onUnmounted(() => {
  aborted = true;
  pendingTimers.forEach(id => clearTimeout(id));
  pendingTimers.clear();
});

interface TrieNode {
  char: string;
  children: Map<string, TrieNode>;
  isEnd: boolean;
  id: number;
}

let nextId = 0;

function createNode(char: string): TrieNode {
  return { char, children: new Map(), isEnd: false, id: nextId++ };
}

const root = ref<TrieNode>(createNode(''));
const inputWord = ref('');
const message = ref(t('Type a word and insert it into the trie', '输入一个单词并插入到 Trie 中'));
const highlightIds = ref<Set<number>>(new Set());
const words = ref<string[]>([]);

function insertWord() {
  const word = inputWord.value.trim().toLowerCase();
  if (!word || !/^[a-z]+$/.test(word)) {
    message.value = t('Enter lowercase letters only', '请只输入小写字母');
    return;
  }
  if (words.value.includes(word)) {
    message.value = t(`"${word}" already exists`, `"${word}" 已存在`);
    return;
  }

  let current = root.value;
  const path: number[] = [current.id];
  for (const ch of word) {
    if (!current.children.has(ch)) {
      current.children.set(ch, createNode(ch));
    }
    current = current.children.get(ch)!;
    path.push(current.id);
  }
  current.isEnd = true;
  words.value.push(word);

  highlightIds.value = new Set(path);
  message.value = t(`Inserted "${word}" (${word.length} nodes traversed)`, `已插入 "${word}"（遍历 ${word.length} 个节点）`);
  inputWord.value = '';

  const id = setTimeout(() => { pendingTimers.delete(id); highlightIds.value = new Set(); }, 800);
  pendingTimers.add(id);
}

async function searchWord() {
  const word = inputWord.value.trim().toLowerCase();
  if (!word) {
    message.value = t('Enter a word to search', '请输入要搜索的单词');
    return;
  }

  let current = root.value;
  const path: number[] = [current.id];

  for (const ch of word) {
    highlightIds.value = new Set(path);
    await delay(200);
    if (aborted) return;
    if (!current.children.has(ch)) {
      message.value = t(`"${word}" not found — no '${ch}' edge from current node`, `未找到 "${word}" — 当前节点无 '${ch}' 边`);
      const id = setTimeout(() => { pendingTimers.delete(id); highlightIds.value = new Set(); }, 800);
      pendingTimers.add(id);
      return;
    }
    current = current.children.get(ch)!;
    path.push(current.id);
  }

  highlightIds.value = new Set(path);
  if (current.isEnd) {
    message.value = t(`Found "${word}"!`, `找到 "${word}"！`);
  } else {
    message.value = t(`"${word}" is a prefix but not a stored word`, `"${word}" 是前缀但不是已存储的单词`);
  }
  const id2 = setTimeout(() => { pendingTimers.delete(id2); highlightIds.value = new Set(); }, 1200);
  pendingTimers.add(id2);
}

function addPresets() {
  for (const w of ['cat', 'car', 'card', 'care', 'dog', 'do']) {
    inputWord.value = w;
    insertWord();
  }
  message.value = t('Added preset words: cat, car, card, care, dog, do', '已添加预设单词：cat, car, card, care, dog, do');
}

function reset() {
  nextId = 0;
  root.value = createNode('');
  words.value = [];
  highlightIds.value = new Set();
  message.value = t('Trie cleared!', 'Trie 已清空！');
  inputWord.value = '';
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface TreeLayout {
  node: TrieNode;
  x: number;
  y: number;
  children: TreeLayout[];
}

function layoutTree(node: TrieNode, depth: number, xOffset: { val: number }): TreeLayout {
  const children: TreeLayout[] = [];
  const sortedKeys = [...node.children.keys()].sort();

  for (const key of sortedKeys) {
    const child = node.children.get(key)!;
    children.push(layoutTree(child, depth + 1, xOffset));
  }

  let x: number;
  if (children.length === 0) {
    x = xOffset.val;
    xOffset.val += 40;
  } else {
    x = (children[0].x + children[children.length - 1].x) / 2;
  }

  return { node, x, y: depth * 45 + 25, children };
}

const treeLayout = computed(() => {
  const xOffset = { val: 30 };
  return layoutTree(root.value, 0, xOffset);
});

function flattenLayout(layout: TreeLayout): TreeLayout[] {
  const result: TreeLayout[] = [layout];
  for (const child of layout.children) {
    result.push(...flattenLayout(child));
  }
  return result;
}

const allNodes = computed(() => flattenLayout(treeLayout.value));
const svgW = computed(() => Math.max(300, allNodes.value.reduce((max, n) => Math.max(max, n.x), 0) + 50));
const svgH = computed(() => Math.max(120, allNodes.value.reduce((max, n) => Math.max(max, n.y), 0) + 40));

function edgesFromLayout(layout: TreeLayout): { from: TreeLayout; to: TreeLayout }[] {
  const edges: { from: TreeLayout; to: TreeLayout }[] = [];
  for (const child of layout.children) {
    edges.push({ from: layout, to: child });
    edges.push(...edgesFromLayout(child));
  }
  return edges;
}

const edges = computed(() => edgesFromLayout(treeLayout.value));
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Trie (Prefix Tree)', '交互式 Trie（前缀树）') }}</div>

    <svg :viewBox="`0 0 ${svgW} ${svgH}`" class="trie-svg">
      <!-- Edges -->
      <line
        v-for="(e, i) in edges"
        :key="'edge-' + i"
        :x1="e.from.x"
        :y1="e.from.y"
        :x2="e.to.x"
        :y2="e.to.y"
        stroke="var(--viz-border)"
        stroke-width="1.5"
      />

      <!-- Nodes -->
      <g v-for="n in allNodes" :key="n.node.id" :transform="`translate(${n.x}, ${n.y})`">
        <circle
          r="15"
          :fill="highlightIds.has(n.node.id) ? 'var(--viz-warning)' : n.node.isEnd ? 'var(--viz-success)' : 'var(--viz-primary)'"
          stroke="#fff"
          stroke-width="1.5"
          :class="{ 'trie-node-pulse': highlightIds.has(n.node.id) }"
        />
        <text
          text-anchor="middle"
          dominant-baseline="central"
          fill="#fff"
          font-size="12"
          font-weight="700"
          font-family="var(--vp-font-family-mono)"
        >{{ n.node.char || '·' }}</text>
        <!-- End marker -->
        <circle
          v-if="n.node.isEnd"
          r="18"
          fill="none"
          stroke="var(--viz-success)"
          stroke-width="2"
          stroke-dasharray="3,2"
        />
      </g>

      <!-- Empty state -->
      <text v-if="words.length === 0" :x="svgW / 2" :y="svgH / 2" text-anchor="middle" fill="var(--viz-muted)" font-size="13">
        {{ t('Empty — insert words to build the trie', '空 — 插入单词来构建 Trie') }}
      </text>
    </svg>

    <!-- Stored words -->
    <div v-if="words.length > 0" class="trie-words">
      <span class="viz-label">{{ t('Words:', '单词：') }}&nbsp;</span>
      <span v-for="w in words" :key="w" class="trie-word-tag">{{ w }}</span>
    </div>

    <div class="viz-controls">
      <input
        v-model="inputWord"
        class="viz-input"
        :placeholder="t('word', '单词')"
        maxlength="10"
        @keydown.enter="insertWord"
      />
      <button class="viz-btn viz-btn--primary" @click="insertWord">{{ t('Insert', '插入') }}</button>
      <button class="viz-btn" @click="searchWord">{{ t('Search', '搜索') }}</button>
      <button class="viz-btn" @click="addPresets">{{ t('Demo', '演示') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.trie-svg {
  width: 100%;
  max-width: 500px;
  height: auto;
  display: block;
  margin: 0 auto;
  min-height: 120px;
}

.trie-node-pulse {
  animation: trie-pulse 0.3s ease;
}

.trie-words {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0.5rem 0;
}

.trie-word-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  background: var(--viz-primary);
  color: #fff;
}

.viz-input {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
  width: 100px;
}

@keyframes trie-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
