<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

type Tag = 'Number' | 'String' | 'Bool' | 'None';

interface TaggedValue {
  tag: Tag;
  display: string;
  rawBytes: string[];
}

const currentTag = ref<Tag>('Number');
const message = ref(t('Click a type button to set the variable. Watch the tag and value change together.', '点击类型按钮设置变量。观察标签和值一起变化。'));
const matchHighlight = ref<Tag | null>(null);
const showMatchResult = ref(false);
const matchResultText = ref('');

const tagMeta: Record<Tag, { color: string; byte: string; description: string }> = {
  Number: { color: 'var(--viz-primary)', byte: '0x01', description: t('IEEE 754 double', 'IEEE 754 双精度') },
  String: { color: 'var(--viz-success)', byte: '0x02', description: t('UTF-8 pointer + length', 'UTF-8 指针 + 长度') },
  Bool: { color: 'var(--viz-warning)', byte: '0x03', description: t('Single byte 0/1', '单字节 0/1') },
  None: { color: 'var(--viz-muted)', byte: '0x00', description: t('No data (unit type)', '无数据（单元类型）') },
};

const values: Record<Tag, TaggedValue> = {
  Number: {
    tag: 'Number',
    display: '42',
    rawBytes: ['0x01', '00', '00', '00', '00', '00', '00', '45', '40'],
  },
  String: {
    tag: 'String',
    display: '"hello"',
    rawBytes: ['0x02', '68', '65', '6C', '6C', '6F', '00', '00', '00'],
  },
  Bool: {
    tag: 'Bool',
    display: 'true',
    rawBytes: ['0x03', '01', '00', '00', '00', '00', '00', '00', '00'],
  },
  None: {
    tag: 'None',
    display: 'None',
    rawBytes: ['0x00', '00', '00', '00', '00', '00', '00', '00', '00'],
  },
};

const current = computed(() => values[currentTag.value]);
const meta = computed(() => tagMeta[currentTag.value]);

const matchBranches = computed(() => [
  { tag: 'Number' as Tag, code: 'Number(n) => format!("got number: {n}")' },
  { tag: 'String' as Tag, code: 'String(s) => format!("got string: {s}")' },
  { tag: 'Bool' as Tag, code: 'Bool(b) => format!("got bool: {b}")' },
  { tag: 'None' as Tag, code: 'None => "got nothing".to_string()' },
]);

const matchOutputs: Record<Tag, string> = {
  Number: '"got number: 42"',
  String: '"got string: hello"',
  Bool: '"got bool: true"',
  None: '"got nothing"',
};

function setTag(tag: Tag) {
  currentTag.value = tag;
  showMatchResult.value = false;
  matchHighlight.value = null;
  message.value = t(`Variable set to ${tag}(${values[tag].display}). Tag byte = ${tagMeta[tag].byte}.`, `变量设置为 ${tag}(${values[tag].display})。标签字节 = ${tagMeta[tag].byte}。`);
}

function runMatch() {
  matchHighlight.value = currentTag.value;
  showMatchResult.value = true;
  matchResultText.value = matchOutputs[currentTag.value];
  message.value = t(`match dispatched to ${currentTag.value} branch -> ${matchResultText.value}`, `match 分派到 ${currentTag.value} 分支 -> ${matchResultText.value}`);
}

watch(currentTag, () => {
  showMatchResult.value = false;
  matchHighlight.value = null;
});

function reset() {
  currentTag.value = 'Number';
  matchHighlight.value = null;
  showMatchResult.value = false;
  matchResultText.value = '';
  message.value = t('Click a type button to set the variable. Watch the tag and value change together.', '点击类型按钮设置变量。观察标签和值一起变化。');
}
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Tagged Union', '交互式 Tagged Union') }}</div>

    <!-- Type selector buttons -->
    <div class="tu-selector">
      <div class="tu-selector-label">{{ t('Set variable to:', '设置变量为：') }}</div>
      <div class="tu-type-btns">
        <button
          v-for="tag in (['Number', 'String', 'Bool', 'None'] as Tag[])"
          :key="tag"
          class="tu-type-btn"
          :class="{ 'tu-type-btn--active': currentTag === tag }"
          :style="currentTag === tag ? { borderColor: tagMeta[tag].color, background: tagMeta[tag].color } : {}"
          @click="setTag(tag)"
        >
          {{ tag }}({{ values[tag].display }})
        </button>
      </div>
    </div>

    <!-- Variable box -->
    <div class="tu-variable-box" :style="{ borderColor: meta.color }">
      <div class="tu-var-header">
        <span class="tu-var-label">{{ t('Variable', '变量') }}</span>
      </div>
      <div class="tu-var-content">
        <span
          class="tu-tag-badge"
          :style="{ background: meta.color }"
        >{{ current.tag }}</span>
        <span class="tu-var-value" :style="{ color: meta.color }">{{ current.display }}</span>
      </div>
      <div class="tu-var-meta">{{ meta.description }}</div>
    </div>

    <!-- Memory layout -->
    <div class="tu-memory">
      <div class="tu-memory-title">{{ t('Memory Layout (tag byte + value bytes)', '内存布局（标签字节 + 值字节）') }}</div>
      <div class="tu-memory-cells">
        <div
          v-for="(byte, i) in current.rawBytes"
          :key="i"
          class="tu-mem-cell"
          :class="{
            'tu-mem-cell--tag': i === 0,
            'tu-mem-cell--data': i > 0 && !((currentTag === 'None' && i > 0) || (currentTag === 'Bool' && i > 1)),
            'tu-mem-cell--unused': (currentTag === 'None' && i > 0) || (currentTag === 'Bool' && i > 1),
          }"
          :style="i === 0 ? { borderColor: meta.color } : {}"
        >
          <div class="tu-mem-val">{{ byte }}</div>
          <div class="tu-mem-label">
            {{ i === 0 ? 'TAG' : `+${i}` }}
          </div>
        </div>
      </div>
      <div class="tu-mem-legend">
        <span class="tu-legend-item">
          <span class="tu-legend-dot tu-legend-dot--tag"></span>
          {{ t('Tag (determines type)', 'Tag（决定类型）') }}
        </span>
        <span class="tu-legend-item">
          <span class="tu-legend-dot tu-legend-dot--data"></span>
          {{ t('Value (interpreted per tag)', 'Value（按标签解释）') }}
        </span>
      </div>
    </div>

    <!-- Match block -->
    <div class="tu-match">
      <div class="tu-match-header">
        <span class="tu-match-keyword">match</span> variable {
      </div>
      <div
        v-for="branch in matchBranches"
        :key="branch.tag"
        class="tu-match-arm"
        :class="{
          'tu-match-arm--active': matchHighlight === branch.tag,
          'tu-match-arm--dim': matchHighlight !== null && matchHighlight !== branch.tag,
        }"
        :style="matchHighlight === branch.tag ? { borderLeftColor: tagMeta[branch.tag].color } : {}"
      >
        <span class="tu-arm-code">{{ branch.code }}</span>
        <span
          v-if="matchHighlight === branch.tag"
          class="tu-arm-indicator"
          :style="{ color: tagMeta[branch.tag].color }"
        >&lt;-- {{ t('executes', '执行') }}</span>
      </div>
      <div class="tu-match-footer">}</div>
    </div>

    <!-- Match result -->
    <div v-if="showMatchResult" class="tu-match-result">
      <span class="tu-result-label">{{ t('Output:', '输出：') }}</span>
      <span class="tu-result-value">{{ matchResultText }}</span>
    </div>

    <div class="viz-controls">
      <button class="viz-btn viz-btn--primary" @click="runMatch">{{ t('Run match', '运行 match') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
/* Selector */
.tu-selector {
  padding: 0.5rem 0;
}

.tu-selector-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--viz-muted);
  margin-bottom: 0.375rem;
}

.tu-type-btns {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.tu-type-btn {
  padding: 0.375rem 0.75rem;
  border: 2px solid var(--viz-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tu-type-btn:hover {
  border-color: var(--viz-primary);
}

.tu-type-btn--active {
  color: #fff;
}

/* Variable box */
.tu-variable-box {
  border: 2px solid var(--viz-border);
  border-radius: 8px;
  padding: 0.75rem;
  margin: 0.5rem 0;
  transition: border-color 0.3s ease;
  background: var(--vp-c-bg);
}

.tu-var-header {
  margin-bottom: 0.375rem;
}

.tu-var-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-muted);
}

.tu-var-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tu-tag-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: #fff;
  transition: background 0.3s ease;
}

.tu-var-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  transition: color 0.3s ease;
}

.tu-var-meta {
  font-size: 0.625rem;
  color: var(--viz-muted);
  margin-top: 0.25rem;
  font-family: var(--vp-font-family-mono);
}

/* Memory layout */
.tu-memory {
  padding: 0.5rem 0;
}

.tu-memory-title {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-muted);
  margin-bottom: 0.375rem;
}

.tu-memory-cells {
  display: flex;
  gap: 2px;
}

.tu-mem-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.375rem 0.25rem;
  border: 2px solid var(--viz-border);
  border-radius: 3px;
  background: var(--vp-c-bg);
  transition: all 0.3s ease;
  flex: 1;
  min-width: 0;
}

.tu-mem-cell--tag {
  background: color-mix(in srgb, var(--viz-warning) 12%, var(--vp-c-bg));
  border-color: var(--viz-warning);
}

.tu-mem-cell--data {
  background: color-mix(in srgb, var(--viz-primary) 6%, var(--vp-c-bg));
  border-color: color-mix(in srgb, var(--viz-primary) 40%, var(--viz-border));
}

.tu-mem-cell--unused {
  opacity: 0.35;
  border-style: dashed;
}

.tu-mem-val {
  font-size: 0.625rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
}

.tu-mem-label {
  font-size: 0.5rem;
  font-weight: 600;
  color: var(--viz-muted);
  text-transform: uppercase;
}

.tu-mem-legend {
  display: flex;
  gap: 1rem;
  margin-top: 0.375rem;
}

.tu-legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.5625rem;
  color: var(--viz-muted);
}

.tu-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.tu-legend-dot--tag {
  background: var(--viz-warning);
}

.tu-legend-dot--data {
  background: var(--viz-primary);
}

/* Match block */
.tu-match {
  margin: 0.5rem 0;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  overflow: hidden;
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  background: var(--vp-c-bg);
}

.tu-match-header,
.tu-match-footer {
  padding: 0.375rem 0.625rem;
  color: var(--viz-muted);
  font-weight: 600;
}

.tu-match-keyword {
  color: var(--viz-primary);
  font-weight: 700;
}

.tu-match-arm {
  padding: 0.375rem 0.625rem 0.375rem 1.25rem;
  border-left: 3px solid transparent;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tu-match-arm--active {
  background: color-mix(in srgb, var(--viz-success) 10%, var(--vp-c-bg));
  animation: tu-arm-flash 0.5s ease;
}

.tu-match-arm--dim {
  opacity: 0.35;
}

.tu-arm-code {
  color: var(--viz-text);
}

.tu-arm-indicator {
  font-size: 0.625rem;
  font-weight: 700;
  white-space: nowrap;
  animation: tu-slide-in 0.3s ease;
}

/* Match result */
.tu-match-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 2px solid var(--viz-success);
  border-radius: 6px;
  background: color-mix(in srgb, var(--viz-success) 8%, var(--vp-c-bg));
  animation: tu-fade-in 0.3s ease;
}

.tu-result-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--viz-muted);
}

.tu-result-value {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-success);
}

@keyframes tu-arm-flash {
  0% { background: color-mix(in srgb, var(--viz-success) 25%, var(--vp-c-bg)); }
  100% { background: color-mix(in srgb, var(--viz-success) 10%, var(--vp-c-bg)); }
}

@keyframes tu-slide-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes tu-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .tu-type-btns {
    gap: 0.25rem;
  }
  .tu-type-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
  }
  .tu-var-value {
    font-size: 1rem;
  }
  .tu-memory-cells {
    overflow-x: auto;
  }
  .tu-mem-val {
    font-size: 0.5625rem;
  }
  .tu-match {
    font-size: 0.625rem;
  }
  .tu-arm-code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
