import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useVizTimers } from '../../.vitepress/theme/composables/useVizTimers';

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable();
        return () => null;
      },
    }),
  );
  return { result, unmount: () => wrapper.unmount() };
}

describe('useVizTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delay resolves after specified time', async () => {
    const { result, unmount } = withSetup(() => useVizTimers());
    let resolved = false;
    result.delay(1000).then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).toBe(true);
    unmount();
  });

  it('speed affects timer duration', async () => {
    const { result, unmount } = withSetup(() => useVizTimers());
    result.speed.value = 2;
    let resolved = false;
    result.delay(1000).then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).toBe(true);
    unmount();
  });

  it('safeInterval calls function repeatedly', () => {
    const { result, unmount } = withSetup(() => useVizTimers());
    const fn = vi.fn();
    result.safeInterval(fn, 100);

    vi.advanceTimersByTime(350);
    expect(fn).toHaveBeenCalledTimes(3);
    unmount();
  });

  it('clearAll stops all timers', () => {
    const { result, unmount } = withSetup(() => useVizTimers());
    const fn = vi.fn();
    result.safeInterval(fn, 100);
    result.clearAll();

    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(0);
    unmount();
  });

  it('unmounting component aborts timers', async () => {
    const { result, unmount } = withSetup(() => useVizTimers());
    const fn = vi.fn();
    result.safeInterval(fn, 100);

    unmount();
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(0);
  });

  it('isAborted returns true after unmount', () => {
    const { result, unmount } = withSetup(() => useVizTimers());
    expect(result.isAborted()).toBe(false);
    unmount();
    expect(result.isAborted()).toBe(true);
  });

  it('safeTimeout executes once', () => {
    const { result, unmount } = withSetup(() => useVizTimers());
    const fn = vi.fn();
    result.safeTimeout(fn, 200);

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
  });
});
