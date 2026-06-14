import { ref, onUnmounted } from 'vue';

export function useVizTimers() {
  let aborted = false;
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  const speed = ref(1);

  onUnmounted(() => {
    aborted = true;
    for (const tid of pendingTimers) clearTimeout(tid);
    pendingTimers.clear();
  });

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (aborted) return;
      const tid = setTimeout(() => {
        pendingTimers.delete(tid);
        if (!aborted) resolve();
      }, ms / speed.value);
      pendingTimers.add(tid);
    });
  }

  function safeTimeout(fn: (...args: any[]) => void, ms: number): ReturnType<typeof setTimeout> {
    const tid = setTimeout(() => {
      pendingTimers.delete(tid);
      if (!aborted) fn();
    }, ms / speed.value);
    pendingTimers.add(tid);
    return tid;
  }

  function safeInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
    const tid = setInterval(() => {
      if (aborted) { clearInterval(tid); pendingTimers.delete(tid); return; }
      fn();
    }, ms / speed.value);
    pendingTimers.add(tid);
    return tid;
  }

  function clearAll() {
    for (const tid of pendingTimers) {
      clearTimeout(tid);
      clearInterval(tid);
    }
    pendingTimers.clear();
  }

  function isAborted(): boolean { return aborted; }

  return { delay, safeTimeout, safeInterval, clearAll, speed, isAborted };
}
