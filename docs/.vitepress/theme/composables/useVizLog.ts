import { ref } from 'vue';

export interface LogEntry {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'highlight';
  index: number;
}

export function useVizLog(max = 60) {
  const entries = ref<LogEntry[]>([]);
  let counter = 0;

  function log(text: string, type: LogEntry['type'] = 'info') {
    entries.value.push({ text, type, index: ++counter });
    if (entries.value.length > max) {
      entries.value = entries.value.slice(-max);
    }
  }

  function clear() {
    entries.value = [];
    counter = 0;
  }

  return { entries, log, clear };
}
