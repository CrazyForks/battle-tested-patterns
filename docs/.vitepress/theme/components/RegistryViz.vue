<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
onUnmounted(() => { for (const tid of pendingTimers) clearTimeout(tid); });

interface Handler {
  name: string;
  description: string;
  id: number;
  registeredAt: number;
}

let nextId = 0;
let order = 0;

const availablePlugins = ref([
  { name: 'JSONHandler', description: 'Parse & serialize JSON', registered: false },
  { name: 'XMLHandler', description: 'Parse & serialize XML', registered: false },
  { name: 'CSVHandler', description: 'Parse & serialize CSV', registered: false },
  { name: 'YAMLHandler', description: 'Parse & serialize YAML', registered: false },
  { name: 'TOMLHandler', description: 'Parse & serialize TOML', registered: false },
]);

const registry = ref<Handler[]>([]);
const lookupQuery = ref('');
const message = ref(t('Register handlers into the registry, then look them up by name.', '将处理器注册到注册表中，然后按名称查找。'));
const lookupResult = ref<Handler | null>(null);
const lookupNotFound = ref(false);
const dispatchTarget = ref<string | null>(null);
const flashId = ref(-1);

function registerHandler(pluginName: string) {
  const plugin = availablePlugins.value.find((p) => p.name === pluginName);
  if (!plugin || plugin.registered) return;

  const handler: Handler = {
    name: plugin.name,
    description: plugin.description,
    id: ++nextId,
    registeredAt: ++order,
  };
  registry.value.push(handler);
  plugin.registered = true;
  flashId.value = handler.id;
  lookupResult.value = null;
  lookupNotFound.value = false;
  message.value = t(`Registered "${plugin.name}" (order #${handler.registeredAt}). Registry now has ${registry.value.length} handler(s).`, `已注册 "${plugin.name}"（顺序 #${handler.registeredAt}）。注册表现有 ${registry.value.length} 个处理器。`);
  const tid = setTimeout(() => { pendingTimers.delete(tid); flashId.value = -1; }, 600);
  pendingTimers.add(tid);
}

function unregisterHandler(handler: Handler) {
  const idx = registry.value.findIndex((h) => h.id === handler.id);
  if (idx < 0) return;
  registry.value.splice(idx, 1);
  const plugin = availablePlugins.value.find((p) => p.name === handler.name);
  if (plugin) plugin.registered = false;
  if (lookupResult.value?.id === handler.id) {
    lookupResult.value = null;
  }
  message.value = t(`Unregistered "${handler.name}". ${registry.value.length} handler(s) remain.`, `已注销 "${handler.name}"。剩余 ${registry.value.length} 个处理器。`);
}

function doLookup() {
  const q = lookupQuery.value.trim();
  if (!q) {
    message.value = t('Type a handler name to look up.', '输入处理器名称以查找。');
    return;
  }
  dispatchTarget.value = q;
  const found = registry.value.find(
    (h) => h.name.toLowerCase() === q.toLowerCase(),
  );
  const tid1 = setTimeout(() => {
    pendingTimers.delete(tid1);
    if (found) {
      lookupResult.value = found;
      lookupNotFound.value = false;
      flashId.value = found.id;
      message.value = t(`FOUND: "${found.name}" -> ${found.description}`, `已找到："${found.name}" -> ${found.description}`);
      const tid2 = setTimeout(() => { pendingTimers.delete(tid2); flashId.value = -1; }, 600);
      pendingTimers.add(tid2);
    } else {
      lookupResult.value = null;
      lookupNotFound.value = true;
      message.value = t(`NOT FOUND: No handler registered for "${q}".`, `未找到：没有为 "${q}" 注册的处理器。`);
    }
    const tid3 = setTimeout(() => { pendingTimers.delete(tid3); dispatchTarget.value = null; }, 800);
    pendingTimers.add(tid3);
  }, 300);
  pendingTimers.add(tid1);
  lookupQuery.value = '';
}

function registerAll() {
  availablePlugins.value.forEach((p) => {
    if (!p.registered) registerHandler(p.name);
  });
}

function reset() {
  nextId = 0;
  order = 0;
  registry.value = [];
  availablePlugins.value.forEach((p) => { p.registered = false; });
  lookupQuery.value = '';
  lookupResult.value = null;
  lookupNotFound.value = false;
  dispatchTarget.value = null;
  flashId.value = -1;
  message.value = t('Registry cleared. Register handlers to begin.', '注册表已清空。注册处理器以开始。');
}

const registeredCount = computed(() => registry.value.length);
const availableCount = computed(() => availablePlugins.value.filter((p) => !p.registered).length);
</script>

<template>
  <div class="viz-container">
    <div class="viz-title">{{ t('Interactive Registry', '交互式 Registry') }}</div>

    <div class="rg-layout">
      <!-- Left: available plugins -->
      <div class="rg-panel rg-panel--plugins">
        <div class="rg-panel-header">{{ t('Available Plugins', '可用插件') }}</div>
        <div class="rg-plugin-list">
          <div
            v-for="plugin in availablePlugins"
            :key="plugin.name"
            class="rg-plugin"
            :class="{ 'rg-plugin--registered': plugin.registered }"
          >
            <div class="rg-plugin-info">
              <span class="rg-plugin-name">{{ plugin.name }}</span>
              <span class="rg-plugin-desc">{{ plugin.description }}</span>
            </div>
            <button
              v-if="!plugin.registered"
              class="viz-btn viz-btn--primary rg-btn-sm"
              @click="registerHandler(plugin.name)"
            >{{ t('Register', '注册') }}</button>
            <span v-else class="rg-registered-badge">{{ t('registered', '已注册') }}</span>
          </div>
        </div>
      </div>

      <!-- Center: registry table -->
      <div class="rg-panel rg-panel--registry">
        <div class="rg-panel-header">
          {{ t('Registry Table', '注册表') }}
          <span class="rg-count">({{ registeredCount }})</span>
        </div>

        <!-- Dispatch arrow animation -->
        <div v-if="dispatchTarget" class="rg-dispatch-indicator">
          <span class="rg-dispatch-arrow">--&gt;</span>
          {{ t(`looking up "${dispatchTarget}"...`, `正在查找 "${dispatchTarget}"...`) }}
        </div>

        <div class="rg-table-wrap">
          <table class="rg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t('Name', '名称') }}</th>
                <th>{{ t('Handler', '处理器') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="registry.length === 0">
                <td colspan="4" class="rg-empty">{{ t('No handlers registered', '暂无注册的处理器') }}</td>
              </tr>
              <tr
                v-for="handler in registry"
                :key="handler.id"
                class="rg-row"
                :class="{
                  'rg-row--flash': flashId === handler.id,
                  'rg-row--match': lookupResult?.id === handler.id,
                }"
              >
                <td class="rg-order">{{ handler.registeredAt }}</td>
                <td class="rg-name">{{ handler.name }}</td>
                <td class="rg-desc">{{ handler.description }}</td>
                <td>
                  <button
                    class="rg-action rg-action--rm"
                    :title="t('Unregister', '注销')"
                    @click="unregisterHandler(handler)"
                  >{{ t('unregister', '注销') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right: lookup -->
      <div class="rg-panel rg-panel--lookup">
        <div class="rg-panel-header">{{ t('Lookup', '查找') }}</div>
        <div class="rg-lookup-form">
          <input
            v-model="lookupQuery"
            class="rg-input"
            placeholder="e.g. JSONHandler"
            maxlength="24"
            @keyup.enter="doLookup"
          />
          <button class="viz-btn viz-btn--primary rg-btn-sm" @click="doLookup">{{ t('Resolve', '解析') }}</button>
        </div>

        <!-- Lookup result -->
        <div v-if="lookupResult" class="rg-lookup-result rg-lookup-result--found">
          <div class="rg-result-label">{{ t('Resolved:', '已解析：') }}</div>
          <div class="rg-result-name">{{ lookupResult.name }}</div>
          <div class="rg-result-desc">{{ lookupResult.description }}</div>
        </div>
        <div v-else-if="lookupNotFound" class="rg-lookup-result rg-lookup-result--miss">
          <div class="rg-result-label">{{ t('Not Found', '未找到') }}</div>
          <div class="rg-result-desc">{{ t('No handler matches this key', '没有匹配此键的处理器') }}</div>
        </div>

        <!-- Quick lookup buttons -->
        <div class="rg-quick-lookups">
          <div class="rg-quick-label">{{ t('Quick lookup:', '快速查找：') }}</div>
          <button
            v-for="plugin in availablePlugins"
            :key="plugin.name"
            class="rg-quick-btn"
            :class="{ 'rg-quick-btn--active': plugin.registered }"
            @click="lookupQuery = plugin.name; doLookup()"
          >{{ plugin.name.replace('Handler', '') }}</button>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn" @click="registerAll">{{ t('Register All', '全部注册') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
    </div>

    <div class="viz-status">{{ message }}</div>
  </div>
</template>

<style scoped>
.rg-layout {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  gap: 0.75rem;
  margin: 0.5rem 0;
}

.rg-panel {
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  padding: 0.625rem;
  background: var(--vp-c-bg);
}

.rg-panel-header {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-muted);
  margin-bottom: 0.5rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--viz-border);
}

.rg-count {
  color: var(--viz-primary);
}

/* Plugins panel */
.rg-plugin-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.rg-plugin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.rg-plugin--registered {
  opacity: 0.5;
  border-style: dashed;
}

.rg-plugin-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.rg-plugin-name {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rg-plugin-desc {
  font-size: 0.625rem;
  color: var(--viz-muted);
}

.rg-registered-badge {
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--viz-success);
  white-space: nowrap;
}

.rg-btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
}

/* Registry table */
.rg-dispatch-indicator {
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-warning);
  padding: 0.25rem 0;
  animation: rg-pulse 0.6s ease infinite;
}

.rg-dispatch-arrow {
  font-weight: 700;
}

.rg-table-wrap {
  overflow-x: auto;
}

.rg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
}

.rg-table th {
  text-align: left;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--viz-muted);
  padding: 0.25rem 0.375rem;
  border-bottom: 2px solid var(--viz-border);
}

.rg-table td {
  padding: 0.25rem 0.375rem;
  border-bottom: 1px solid var(--viz-border);
  color: var(--viz-text);
}

.rg-empty {
  text-align: center;
  color: var(--viz-muted);
  font-style: italic;
  padding: 1rem 0.375rem;
}

.rg-row {
  transition: all 0.3s ease;
}

.rg-row--flash {
  background: color-mix(in srgb, var(--viz-primary) 15%, transparent);
  animation: rg-flash 0.5s ease;
}

.rg-row--match {
  background: color-mix(in srgb, var(--viz-success) 12%, transparent);
}

.rg-order {
  color: var(--viz-muted);
  font-size: 0.625rem;
}

.rg-name {
  font-weight: 700;
  color: var(--viz-primary);
}

.rg-desc {
  font-size: 0.625rem;
  color: var(--viz-muted);
}

.rg-action {
  background: none;
  border: none;
  font-size: 0.625rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  cursor: pointer;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  transition: all 0.15s;
}

.rg-action--rm:hover {
  color: var(--viz-danger);
  background: color-mix(in srgb, var(--viz-danger) 10%, transparent);
}

/* Lookup panel */
.rg-lookup-form {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.rg-input {
  flex: 1;
  min-width: 0;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--viz-border);
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  background: var(--vp-c-bg);
  color: var(--viz-text);
}

.rg-input:focus {
  outline: none;
  border-color: var(--viz-primary);
}

.rg-lookup-result {
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  animation: rg-fade-in 0.3s ease;
}

.rg-lookup-result--found {
  border: 1px solid var(--viz-success);
  background: color-mix(in srgb, var(--viz-success) 8%, var(--vp-c-bg));
}

.rg-lookup-result--miss {
  border: 1px solid var(--viz-danger);
  background: color-mix(in srgb, var(--viz-danger) 8%, var(--vp-c-bg));
}

.rg-result-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--viz-muted);
}

.rg-result-name {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-primary);
}

.rg-result-desc {
  font-size: 0.6875rem;
  color: var(--viz-muted);
}

.rg-quick-lookups {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.rg-quick-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--viz-muted);
}

.rg-quick-btn {
  background: none;
  border: 1px solid var(--viz-border);
  border-radius: 3px;
  padding: 0.1875rem 0.375rem;
  font-size: 0.625rem;
  font-family: var(--vp-font-family-mono);
  color: var(--viz-muted);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.rg-quick-btn:hover {
  border-color: var(--viz-primary);
  color: var(--viz-primary);
}

.rg-quick-btn--active {
  border-color: var(--viz-success);
  color: var(--viz-success);
}

@keyframes rg-flash {
  0% { background: color-mix(in srgb, var(--viz-primary) 30%, transparent); }
  100% { background: color-mix(in srgb, var(--viz-primary) 15%, transparent); }
}

@keyframes rg-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes rg-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .rg-layout {
    grid-template-columns: 1fr;
  }
  .rg-table {
    font-size: 0.6875rem;
  }
  .rg-plugin-name {
    font-size: 0.6875rem;
  }
  .rg-input {
    font-size: 0.6875rem;
  }
}
</style>
