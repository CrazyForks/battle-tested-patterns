<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useVizTimers } from '../composables/useVizTimers';
import { useVizLog } from '../composables/useVizLog';
import { useVizHistory } from '../composables/useVizHistory';
import VizLog from './VizLog.vue';
import VizPlaybackBar from './VizPlaybackBar.vue';

const { t } = useI18n();
const { safeTimeout, delay, clearAll, speed, isAborted } = useVizTimers();
const { entries: logEntries, log, clear: clearLog } = useVizLog();

interface Handler {
  name: string;
  description: string;
  id: number;
  registeredAt: number;
}

let nextId = 0;
let order = 0;
let presetRunning = false;

const availablePlugins = ref([
  { name: 'JSONHandler', description: 'Parse & serialize JSON', registered: false },
  { name: 'XMLHandler', description: 'Parse & serialize XML', registered: false },
  { name: 'CSVHandler', description: 'Parse & serialize CSV', registered: false },
  { name: 'YAMLHandler', description: 'Parse & serialize YAML', registered: false },
  { name: 'TOMLHandler', description: 'Parse & serialize TOML', registered: false },
]);

const registry = ref<Handler[]>([]);

interface RegistrySnapshot {
  availablePlugins: Array<{ name: string; description: string; registered: boolean }>;
  registry: Handler[];
}

const history = useVizHistory<RegistrySnapshot>(
  {
    availablePlugins: JSON.parse(JSON.stringify(availablePlugins.value)),
    registry: [],
  },
  {
    getMessage: () => message.value,
    onRestore(snap, msg) {
      presetRunning = false;
      availablePlugins.value = snap.availablePlugins;
      registry.value = snap.registry;
      lookupResult.value = null;
      lookupNotFound.value = false;
      flashId.value = -1;
      dispatchTarget.value = null;
      if (msg !== undefined) message.value = msg;
    },
  },
);

const lookupQuery = ref('');
const message = ref(
  t(
    'Register handlers into the registry, then look them up by name.',
    '将处理器注册到注册表中，然后按名称查找。',
  ),
);
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
  message.value = t(
    `Registered "${plugin.name}" (order #${handler.registeredAt}). Registry now has ${registry.value.length} handler(s).`,
    `已注册 "${plugin.name}"（顺序 #${handler.registeredAt}）。注册表现有 ${registry.value.length} 个处理器。`,
  );
  log(
    t(
      `register "${plugin.name}" (#${handler.registeredAt})`,
      `注册 "${plugin.name}" (#${handler.registeredAt})`,
    ),
    'info',
  );
  safeTimeout(() => {
    flashId.value = -1;
  }, 600);
  history.commit(
    {
      availablePlugins: JSON.parse(JSON.stringify(availablePlugins.value)),
      registry: JSON.parse(JSON.stringify(registry.value)),
    },
    `register ${plugin.name}`,
  );
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
  message.value = t(
    `Unregistered "${handler.name}". ${registry.value.length} handler(s) remain.`,
    `已注销 "${handler.name}"。剩余 ${registry.value.length} 个处理器。`,
  );
  history.commit(
    {
      availablePlugins: JSON.parse(JSON.stringify(availablePlugins.value)),
      registry: JSON.parse(JSON.stringify(registry.value)),
    },
    `unregister ${handler.name}`,
  );
}

function doLookup() {
  const q = lookupQuery.value.trim();
  if (!q) {
    message.value = t('Type a handler name to look up.', '输入处理器名称以查找。');
    return;
  }
  dispatchTarget.value = q;
  const found = registry.value.find((h) => h.name.toLowerCase() === q.toLowerCase());
  safeTimeout(() => {
    if (found) {
      lookupResult.value = found;
      lookupNotFound.value = false;
      flashId.value = found.id;
      message.value = t(
        `FOUND: "${found.name}" -> ${found.description}`,
        `已找到："${found.name}" -> ${found.description}`,
      );
      log(t(`lookup "${found.name}" → found`, `查找 "${found.name}" → 已找到`), 'success');
      safeTimeout(() => {
        flashId.value = -1;
      }, 600);
    } else {
      lookupResult.value = null;
      lookupNotFound.value = true;
      message.value = t(
        `NOT FOUND: No handler registered for "${q}".`,
        `未找到：没有为 "${q}" 注册的处理器。`,
      );
      log(t(`lookup "${q}" → not found`, `查找 "${q}" → 未找到`), 'warning');
    }
    safeTimeout(() => {
      dispatchTarget.value = null;
    }, 800);
  }, 300);
  lookupQuery.value = '';
  history.commit(
    {
      availablePlugins: JSON.parse(JSON.stringify(availablePlugins.value)),
      registry: JSON.parse(JSON.stringify(registry.value)),
    },
    `lookup ${q}`,
  );
}

function registerAll() {
  availablePlugins.value.forEach((p) => {
    if (!p.registered) registerHandler(p.name);
  });
}

function reset() {
  clearAll();
  presetRunning = false;
  nextId = 0;
  order = 0;
  registry.value = [];
  availablePlugins.value.forEach((p) => {
    p.registered = false;
  });
  lookupQuery.value = '';
  lookupResult.value = null;
  lookupNotFound.value = false;
  dispatchTarget.value = null;
  flashId.value = -1;
  clearLog();
  history.reset();
  message.value = t(
    'Registry cleared. Register handlers to begin.',
    '注册表已清空。注册处理器以开始。',
  );
}

const registeredCount = computed(() => registry.value.length);

/* ---------- Preset scenarios ---------- */

async function presetRegisterAndLookup() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Preset: registering all plugins, then resolving each by name...',
    '预设：注册所有插件，然后按名称逐一解析...',
  );

  // Register all plugins one by one
  for (const plugin of availablePlugins.value) {
    await delay(500);
    if (!presetRunning || isAborted()) return;
    registerHandler(plugin.name);
  }

  await delay(600);
  if (!presetRunning || isAborted()) return;

  // Lookup each one
  for (const plugin of availablePlugins.value) {
    await delay(500);
    if (!presetRunning || isAborted()) return;
    lookupQuery.value = plugin.name;
    doLookup();
  }

  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Register-then-resolve is the service locator pattern — Java ServiceLoader, Spring @Component scanning, and VSCode extension host all use a registry to decouple providers from consumers. Lookup is O(1) by name.',
    '先注册再解析是服务定位器模式 — Java ServiceLoader、Spring @Component 扫描和 VSCode 扩展主机都使用注册表来解耦提供者和消费者。按名称查找是 O(1)。',
  );
  log(
    t('Service locator: register then resolve O(1)', '服务定位器：注册后 O(1) 解析'),
    'highlight',
  );
  presetRunning = false;
}

async function presetLateBind() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    'Preset: demonstrating late binding — register some, lookup, then register more...',
    '预设：演示延迟绑定 — 先注册一些，查找，然后注册更多...',
  );

  // Register first 2
  await delay(500);
  if (!presetRunning || isAborted()) return;
  registerHandler('JSONHandler');

  await delay(500);
  if (!presetRunning || isAborted()) return;
  registerHandler('XMLHandler');

  // Lookup one of them
  await delay(600);
  if (!presetRunning || isAborted()) return;
  lookupQuery.value = 'JSONHandler';
  doLookup();

  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Two handlers registered. Now registering more at runtime...',
    '已注册两个处理器。现在在运行时注册更多...',
  );

  // Register 2 more
  await delay(500);
  if (!presetRunning || isAborted()) return;
  registerHandler('CSVHandler');

  await delay(500);
  if (!presetRunning || isAborted()) return;
  registerHandler('YAMLHandler');

  // Lookup one of the new ones
  await delay(600);
  if (!presetRunning || isAborted()) return;
  lookupQuery.value = 'YAMLHandler';
  doLookup();

  await delay(800);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Late binding: plugins registered at runtime, not compile time. This is how Express middleware (app.use), Webpack loaders (module.rules), and browser custom elements (customElements.define) work — register anytime, resolve on demand.',
    '延迟绑定：插件在运行时注册，而非编译时。Express 中间件（app.use）、Webpack 加载器（module.rules）和浏览器自定义元素（customElements.define）都是这样工作的 — 随时注册，按需解析。',
  );
  log(
    t('Late binding: register at runtime, resolve on demand', '延迟绑定：运行时注册，按需解析'),
    'highlight',
  );
  presetRunning = false;
}

async function presetMissAndFallback() {
  if (presetRunning) return;
  reset();
  presetRunning = true;
  message.value = t(
    "Preset: register 2 handlers, then look up a name that doesn't exist...",
    '预设：注册 2 个处理器，然后查找一个不存在的名称...',
  );

  // Register 2 handlers
  await delay(500);
  if (!presetRunning || isAborted()) return;
  registerHandler('JSONHandler');

  await delay(500);
  if (!presetRunning || isAborted()) return;
  registerHandler('XMLHandler');

  await delay(600);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Two handlers registered. Now looking up "ProtobufHandler" which was never registered...',
    '已注册两个处理器。现在查找从未注册的 "ProtobufHandler"...',
  );

  // Lookup a name that doesn't exist
  await delay(600);
  if (!presetRunning || isAborted()) return;
  lookupQuery.value = 'ProtobufHandler';
  doLookup();

  await delay(1000);
  if (!presetRunning || isAborted()) return;
  message.value = t(
    'Key not found — the registry has no fallback. In production: HTTP returns 404, MIME sniffing kicks in, or a default handler catches unregistered types. Kubernetes uses admission webhooks as a registry with deny-by-default.',
    '键未找到 — 注册表没有回退机制。在生产环境中：HTTP 返回 404，MIME 嗅探介入，或默认处理器捕获未注册的类型。Kubernetes 使用准入 webhook 作为默认拒绝的注册表。',
  );
  log(
    t(
      'Miss with no fallback — production needs default handlers',
      '未命中无回退 — 生产环境需要默认处理器',
    ),
    'highlight',
  );
  presetRunning = false;
}
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
            >
              {{ t('Register', '注册') }}
            </button>
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
                <td colspan="4" class="rg-empty">
                  {{ t('No handlers registered', '暂无注册的处理器') }}
                </td>
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
                  >
                    {{ t('unregister', '注销') }}
                  </button>
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
          <button class="viz-btn viz-btn--primary rg-btn-sm" @click="doLookup">
            {{ t('Resolve', '解析') }}
          </button>
        </div>

        <!-- Lookup result -->
        <div v-if="lookupResult" class="rg-lookup-result rg-lookup-result--found">
          <div class="rg-result-label">{{ t('Resolved:', '已解析：') }}</div>
          <div class="rg-result-name">{{ lookupResult.name }}</div>
          <div class="rg-result-desc">{{ lookupResult.description }}</div>
        </div>
        <div v-else-if="lookupNotFound" class="rg-lookup-result rg-lookup-result--miss">
          <div class="rg-result-label">{{ t('Not Found', '未找到') }}</div>
          <div class="rg-result-desc">
            {{ t('No handler matches this key', '没有匹配此键的处理器') }}
          </div>
        </div>

        <!-- Quick lookup buttons -->
        <div class="rg-quick-lookups">
          <div class="rg-quick-label">{{ t('Quick lookup:', '快速查找：') }}</div>
          <button
            v-for="plugin in availablePlugins"
            :key="plugin.name"
            class="rg-quick-btn"
            :class="{ 'rg-quick-btn--active': plugin.registered }"
            @click="
              lookupQuery = plugin.name;
              doLookup();
            "
          >
            {{ plugin.name.replace('Handler', '') }}
          </button>
        </div>
      </div>
    </div>

    <div class="viz-controls">
      <button class="viz-btn" @click="registerAll">{{ t('Register All', '全部注册') }}</button>
      <button class="viz-btn viz-btn--danger" @click="reset">{{ t('Reset', '重置') }}</button>
      <div class="viz-speed">
        <input type="range" min="0.5" max="3" step="0.5" v-model.number="speed" />
        <span class="viz-speed-val">{{ speed }}x</span>
      </div>
    </div>

    <div class="viz-presets">
      <span class="viz-label">{{ t('Scenarios:', '场景：') }}</span>
      <button class="viz-btn" @click="presetRegisterAndLookup">
        {{ t('Register & Lookup', '注册查找') }}
      </button>
      <button class="viz-btn" @click="presetLateBind">{{ t('Late Binding', '延迟绑定') }}</button>
      <button class="viz-btn" @click="presetMissAndFallback">
        {{ t('Key Miss', '键未命中') }}
      </button>
    </div>

    <div class="viz-status" aria-live="polite">{{ message }}</div>
    <VizPlaybackBar :history="history" :speed="speed" />
    <VizLog :entries="logEntries" @clear="clearLog" />
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
  border-radius: var(--viz-radius-sm);
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
  border-radius: var(--viz-radius-sm);
  transition: all var(--viz-transition);
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
  animation: viz-pulse 0.6s ease infinite;
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
  transition: all var(--viz-transition);
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
  border-radius: var(--viz-radius-sm);
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
  border-radius: var(--viz-radius-sm);
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
  border-radius: var(--viz-radius-sm);
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
  border-radius: var(--viz-radius-sm);
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
  0% {
    background: color-mix(in srgb, var(--viz-primary) 30%, transparent);
  }

  100% {
    background: color-mix(in srgb, var(--viz-primary) 15%, transparent);
  }
}

@keyframes rg-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (width <= 640px) {
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
