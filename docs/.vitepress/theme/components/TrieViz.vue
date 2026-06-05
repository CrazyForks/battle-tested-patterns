<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import VizLog from './VizLog.vue';

const { t } = useI18n();
const { safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

let presetRunning = false;

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
  log(message.value, 'info');
  inputWord.value = '';

  safeTimeout(() => { highlightIds.value = new Set(); }, 800);
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
    if (isAborted()) return;
    if (!current.children.has(ch)) {
      message.value = t(`"${word}" not found — no '${ch}' edge from current node`, `未找到 "${word}" — 当前节点无 '${ch}' 边`);
      log(message.value, 'error');
      safeTimeout(() => { highlightIds.value = new Set(); }, 800);
      return;
    }
    current = current.children.get(ch)!;
    path.push(current.id);
  }

  highlightIds.value = new Set(path);
  if (current.isEnd) {
    message.value = t(`Found "${word}"!`, `找到 "${word}"！`);
    log(message.value, 'success');
  } else {
    message.value = t(`"${word}" is a prefix but not a stored word`, `"${word}" 是前缀但不是已存储的单词`);
    log(message.value, 'warning');
  }
  safeTimeout(() => { highlightIds.value = new Set(); }, 1200);
}

function addPresets() {
  for (const w of ['cat', 'car', 'card', 'care', 'dog', 'do']) {
    inputWord.value = w;
    insertWord();
  }
  message.value = t('Added preset words: cat, car, card, care, dog, do', '已添加预设单词：cat, car, card, care, dog, do');
}

function reset() {
  clearAll();
  presetRunning = false;
  nextId = 0;
  root.value = createNode('');
  words.value = [];
  highlightIds.value = new Set();
  message.value = t('Trie cleared!', 'Trie 已清空！');
  clearLog();
  inputWord.value = '';
}

async function presetPrefixSharing() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Prefix sharing: 'cat', 'car', 'card', 'care' share the prefix 'ca'. The trie stores shared prefixes once — 4 words but only 7 unique nodes instead of 14 characters.",
    "前缀共享：'cat'、'car'、'card'、'care' 共享前缀 'ca'。Trie 只存储一次共享前缀 — 4 个单词仅需 7 个唯一节点，而非 14 个字符。"
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  for (const word of ['cat', 'car', 'card', 'care']) {
    inputWord.value = word;
    insertWord();
    await delay(500);
    if (!presetRunning || isAborted()) return;
  }

  message.value = t(
    "Prefix sharing saved 50% storage (7 nodes vs 14 characters). Linux uses LC-trie (fib_trie.c) for IPv4 routing — millions of routes compressed via shared prefixes. Autocomplete systems (Google Search, IDE IntelliSense) use tries for O(k) prefix lookup where k = query length.",
    "前缀共享节省了 50% 存储（7 个节点 vs 14 个字符）。Linux 使用 LC-trie（fib_trie.c）进行 IPv4 路由 — 数百万条路由通过共享前缀压缩。自动补全系统（Google 搜索、IDE IntelliSense）使用 Trie 实现 O(k) 前缀查找，其中 k = 查询长度。"
  );
  log(message.value, 'success');
  presetRunning = false;
}

async function presetSearchPath() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Search traversal: following edges character by character. Each step is O(1) — total search is O(k) where k = word length, regardless of how many words are stored. Compare with hash table O(k) for hashing + O(1) lookup, but tries also support prefix queries.",
    "搜索遍历：逐字符沿边查找。每步 O(1) — 总搜索为 O(k)，其中 k = 单词长度，与存储的单词数量无关。对比哈希表 O(k) 哈希 + O(1) 查找，但 Trie 还支持前缀查询。"
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  for (const word of ['cat', 'car', 'card', 'care']) {
    inputWord.value = word;
    insertWord();
    await delay(400);
    if (!presetRunning || isAborted()) return;
  }

  inputWord.value = 'card';
  await searchWord();
  await delay(600);
  if (!presetRunning || isAborted()) return;

  inputWord.value = 'cap';
  await searchWord();
  await delay(400);
  if (!presetRunning || isAborted()) return;

  message.value = t(
    “'card' found, 'cap' not found — failed at 'p' edge from 'ca'. Tries give precise failure points; hash tables just say 'not found'. DNS resolvers use tries for domain name lookup (right-to-left: com → example → www).”,
    `找到 'card'，未找到 'cap' — 在 'ca' 处的 'p' 边失败。Trie 给出精确失败点；哈希表只会说”未找到”。DNS 解析器使用 Trie 进行域名查找（从右到左：com → example → www）。`
  );
  log(message.value, 'highlight');
  presetRunning = false;
}

async function presetDenseTree() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Dense subtree: all words share 'do' prefix. Radix tries (Patricia tries) compress single-child chains: 'd-o-g' becomes one node 'dog'. Redis RAX does this for memory-efficient key storage. Go's HTTP router (httprouter) uses radix tries for O(k) URL matching.",
    "密集子树：所有单词共享 'do' 前缀。基数树（Patricia 树）压缩单子链：'d-o-g' 变为一个节点 'dog'。Redis RAX 以此实现内存高效的键存储。Go 的 HTTP 路由器（httprouter）使用基数树实现 O(k) URL 匹配。"
  );
  await delay(600);
  if (!presetRunning || isAborted()) return;

  for (const word of ['do', 'dog', 'dot', 'dote', 'dots']) {
    inputWord.value = word;
    insertWord();
    await delay(500);
    if (!presetRunning || isAborted()) return;
  }

  message.value = t(
    "Dense subtree built: 5 words, all branching from 'do'. Radix tries (Patricia tries) compress single-child chains: 'd-o-g' becomes one node 'dog'. Redis RAX does this for memory-efficient key storage. Go's HTTP router (httprouter) uses radix tries for O(k) URL matching.",
    "密集子树已构建：5 个单词，全部从 'do' 分支。基数树（Patricia 树）压缩单子链：'d-o-g' 变为一个节点 'dog'。Redis RAX 以此实现内存高效的键存储。Go 的 HTTP 路由器（httprouter）使用基数树实现 O(k) URL 匹配。"
  );
  log(message.value, 'highlight');
  presetRunning = false;
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
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetPrefixSharing">{{ t('Prefix Sharing', '前缀共享') }}</button>
      <button class="viz-btn" @click="presetSearchPath">{{ t('Search Path', '搜索路径') }}</button>
      <button class="viz-btn" @click="presetDenseTree">{{ t('Dense Tree', '密集树') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
    <VizLog :entries="logEntries" @clear="clearLog" />
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
  animation: viz-pulse 0.3s ease;
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
</style>
