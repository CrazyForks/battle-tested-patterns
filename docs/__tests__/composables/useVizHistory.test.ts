import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { useVizHistory } from '../../.vitepress/theme/composables/useVizHistory';

function withSetup<T>(fn: () => T) {
  let result!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        result = fn();
        return () => null;
      },
    }),
  );
  return { result, unmount: () => wrapper.unmount() };
}

describe('useVizHistory', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('initializes with one entry at index 0', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    expect(result.currentIndex.value).toBe(0);
    expect(result.totalSteps.value).toBe(1);
    expect(result.canUndo.value).toBe(false);
    expect(result.canRedo.value).toBe(false);
  });

  it('commit adds a snapshot and advances index', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1], 'add 1');
    expect(result.currentIndex.value).toBe(1);
    expect(result.totalSteps.value).toBe(2);
    expect(result.canUndo.value).toBe(true);
    expect(result.canRedo.value).toBe(false);
    expect(result.currentLabel.value).toBe('add 1');
  });

  it('undo returns previous state', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1], 'add 1');
    result.commit([1, 2], 'add 2');
    const state = result.undo();
    expect(state).toEqual([1]);
    expect(result.currentIndex.value).toBe(1);
    expect(result.canRedo.value).toBe(true);
  });

  it('redo returns next state', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1], 'add 1');
    result.commit([1, 2], 'add 2');
    result.undo();
    const state = result.redo();
    expect(state).toEqual([1, 2]);
    expect(result.currentIndex.value).toBe(2);
    expect(result.canRedo.value).toBe(false);
  });

  it('undo at start returns undefined', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    expect(result.undo()).toBeUndefined();
    expect(result.currentIndex.value).toBe(0);
  });

  it('redo at end returns undefined', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1]);
    expect(result.redo()).toBeUndefined();
  });

  it('commit after undo truncates redo history', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1], 'a');
    result.commit([1, 2], 'b');
    result.commit([1, 2, 3], 'c');
    result.undo(); // back to [1, 2]
    result.undo(); // back to [1]
    result.commit([1, 99], 'branch'); // new branch
    expect(result.totalSteps.value).toBe(3); // initial + [1] + [1,99]
    expect(result.canRedo.value).toBe(false);
    expect(result.redo()).toBeUndefined();
  });

  it('goto jumps to specific index', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1]);
    result.commit([1, 2]);
    result.commit([1, 2, 3]);
    const state = result.goto(1);
    expect(state).toEqual([1]);
    expect(result.currentIndex.value).toBe(1);
  });

  it('goto with invalid index returns undefined', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    expect(result.goto(-1)).toBeUndefined();
    expect(result.goto(99)).toBeUndefined();
  });

  it('reset clears history', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1]);
    result.commit([1, 2]);
    result.reset();
    expect(result.currentIndex.value).toBe(0);
    expect(result.totalSteps.value).toBe(1);
    expect(result.canUndo.value).toBe(false);
  });

  it('reset with new initial state', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    result.commit([1]);
    result.reset([99]);
    const state = result.goto(0);
    expect(state).toEqual([99]);
  });

  it('enforces maxHistory limit', () => {
    const { result } = withSetup(() => useVizHistory<number>(0, { maxHistory: 5 }));
    for (let i = 1; i <= 10; i++) result.commit(i);
    expect(result.totalSteps.value).toBe(5);
    // Oldest entries trimmed, newest preserved
    const oldest = result.goto(0);
    expect(oldest).toBe(6); // entries 6,7,8,9,10
  });

  it('play auto-advances through history', () => {
    const { result, unmount } = withSetup(() => useVizHistory<number>(0));
    result.commit(1);
    result.commit(2);
    result.commit(3);
    result.goto(0); // go to start
    result.play();
    expect(result.isPlaying.value).toBe(true);
    vi.advanceTimersByTime(800);
    expect(result.currentIndex.value).toBe(1);
    vi.advanceTimersByTime(800);
    expect(result.currentIndex.value).toBe(2);
    vi.advanceTimersByTime(800);
    expect(result.currentIndex.value).toBe(3);
    expect(result.isPlaying.value).toBe(false); // stops at end
    unmount();
  });

  it('pause stops auto-play', () => {
    const { result, unmount } = withSetup(() => useVizHistory<number>(0));
    result.commit(1);
    result.commit(2);
    result.goto(0);
    result.play();
    vi.advanceTimersByTime(800);
    result.pause();
    expect(result.isPlaying.value).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(result.currentIndex.value).toBe(1); // didn't advance further
    unmount();
  });

  it('play from end restarts from beginning', () => {
    const { result, unmount } = withSetup(() => useVizHistory<number>(0));
    result.commit(1);
    result.commit(2);
    // Already at end (index 2)
    result.play();
    expect(result.currentIndex.value).toBe(0); // restarted
    vi.advanceTimersByTime(800);
    expect(result.currentIndex.value).toBe(1);
    unmount();
  });

  it('cleans up timer on unmount', () => {
    const { result, unmount } = withSetup(() => useVizHistory<number>(0));
    result.commit(1);
    result.goto(0);
    result.play();
    unmount();
    // Should not throw
    vi.advanceTimersByTime(10000);
  });

  it('snapshots are independent (mutation safety)', () => {
    const { result } = withSetup(() => useVizHistory<number[]>([]));
    const arr = [1, 2, 3];
    result.commit(arr, 'original');
    arr.push(4); // mutate original
    const restored = result.goto(1);
    expect(restored).toEqual([1, 2, 3]); // snapshot unaffected
  });

  // === onRestore boundary tests ===

  describe('onRestore callback boundaries', () => {
    it('commit does NOT trigger onRestore (no circular loop)', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1, 'a');
      result.commit(2, 'b');
      result.commit(3, 'c');
      expect(onRestore).not.toHaveBeenCalled();
    });

    it('reset does NOT trigger onRestore', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1);
      result.commit(2);
      result.reset();
      expect(onRestore).not.toHaveBeenCalled();
    });

    it('undo triggers onRestore with correct state', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(10);
      result.commit(20);
      result.undo(); // back to 10
      expect(onRestore).toHaveBeenCalledTimes(1);
      // onRestore receives (state, message); message is undefined without getMessage.
      expect(onRestore).toHaveBeenCalledWith(10, undefined);
    });

    it('redo triggers onRestore with correct state', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(10);
      result.commit(20);
      result.undo(); // triggers once
      onRestore.mockClear();
      result.redo(); // back to 20
      expect(onRestore).toHaveBeenCalledTimes(1);
      expect(onRestore).toHaveBeenCalledWith(20, undefined);
    });

    it('goto triggers onRestore', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1);
      result.commit(2);
      result.commit(3);
      result.goto(1); // jump to state=1
      expect(onRestore).toHaveBeenCalledTimes(1);
      expect(onRestore).toHaveBeenCalledWith(1, undefined);
    });

    it('goto with invalid index does NOT trigger onRestore', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1);
      result.goto(-1);
      result.goto(99);
      expect(onRestore).not.toHaveBeenCalled();
    });

    it('play triggers onRestore for each step', () => {
      const onRestore = vi.fn();
      const { result, unmount } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1);
      result.commit(2);
      result.commit(3);
      result.goto(0); // triggers once
      onRestore.mockClear();
      result.play();
      vi.advanceTimersByTime(800); // step to 1
      expect(onRestore).toHaveBeenCalledWith(1, undefined);
      vi.advanceTimersByTime(800); // step to 2
      expect(onRestore).toHaveBeenCalledWith(2, undefined);
      vi.advanceTimersByTime(800); // step to 3
      expect(onRestore).toHaveBeenCalledWith(3, undefined);
      expect(onRestore).toHaveBeenCalledTimes(3);
      expect(result.isPlaying.value).toBe(false); // auto-stopped
      unmount();
    });

    it('reset after commit then immediate commit works correctly', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1);
      result.commit(2);
      result.reset();
      // Immediately commit after reset
      result.commit(99, 'fresh');
      expect(result.totalSteps.value).toBe(2); // initial + 99
      expect(result.currentIndex.value).toBe(1);
      expect(onRestore).not.toHaveBeenCalled(); // neither reset nor commit triggers
    });

    it('rapid consecutive commits do not lose entries', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      for (let i = 1; i <= 50; i++) result.commit(i);
      expect(result.totalSteps.value).toBe(51); // initial + 50
      expect(result.currentIndex.value).toBe(50);
      expect(onRestore).not.toHaveBeenCalled();
      // Undo all the way back
      for (let i = 0; i < 50; i++) result.undo();
      expect(result.currentIndex.value).toBe(0);
      expect(onRestore).toHaveBeenCalledTimes(50);
      expect(onRestore).toHaveBeenLastCalledWith(0, undefined); // initial state
    });

    it('onRestore receives a clone, not a reference to internal state', () => {
      let restored: number[] | null = null;
      const { result } = withSetup(() =>
        useVizHistory<number[]>([], {
          onRestore: (s) => {
            restored = s;
          },
        }),
      );
      result.commit([1, 2, 3]);
      result.undo(); // restores []
      expect(restored).toEqual([]);
      // Mutate the restored value — should not affect history
      restored!.push(999);
      result.redo(); // restores [1,2,3]
      expect(restored).toEqual([1, 2, 3]); // not polluted
    });

    it('play restart from end triggers onRestore for index 0', () => {
      const onRestore = vi.fn();
      const { result, unmount } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1);
      result.commit(2);
      // At end (index 2), play should restart from 0
      result.play();
      // play() sets index to 0 which triggers onRestore
      expect(onRestore).toHaveBeenCalledWith(0, undefined);
      unmount();
    });
  });

  // === getMessage / message-in-snapshot boundaries ===

  describe('getMessage (status-bar message travels with snapshots)', () => {
    it('captures the current message at commit time', () => {
      let msg = 'initial msg';
      const onRestore = vi.fn();
      const { result } = withSetup(() =>
        useVizHistory<number>(0, { onRestore, getMessage: () => msg }),
      );
      msg = 'after first action';
      result.commit(1);
      msg = 'after second action';
      result.commit(2);

      // Undo restores the message captured when state=1 was committed.
      msg = 'live message (should be overwritten by restore)';
      result.undo();
      expect(onRestore).toHaveBeenLastCalledWith(1, 'after first action');
    });

    it('restores the per-step message on undo/redo/goto', () => {
      let msg = 'm0';
      const seen: Array<[number, string | undefined]> = [];
      const { result } = withSetup(() =>
        useVizHistory<number>(0, {
          getMessage: () => msg,
          onRestore: (s, m) => seen.push([s, m]),
        }),
      );
      msg = 'm1';
      result.commit(1);
      msg = 'm2';
      result.commit(2);
      msg = 'm3';
      result.commit(3);

      result.goto(1); // → state 1 / m1
      result.goto(0); // → state 0 / initial snapshot has NO message (TDZ-safe)
      result.redo(); // → state 1 / m1
      expect(seen).toEqual([
        [1, 'm1'],
        [0, undefined],
        [1, 'm1'],
      ]);
    });

    it('initial snapshot omits message at construction but reset re-captures it', () => {
      let msg = 'start';
      const onRestore = vi.fn();
      const { result } = withSetup(() =>
        useVizHistory<number>(0, { onRestore, getMessage: () => msg }),
      );
      msg = 'changed';
      result.commit(1);
      // The construction-time initial snapshot intentionally has NO message
      // (getMessage() is not called during setup to avoid declaration-order TDZ
      // in components where the message ref is declared after useVizHistory()).
      result.undo();
      expect(onRestore).toHaveBeenLastCalledWith(0, undefined);

      // reset() runs after setup, so it safely re-captures the current message
      // for the fresh initial snapshot.
      msg = 'after reset';
      result.reset();
      onRestore.mockClear();
      msg = 'changed again';
      result.commit(9);
      result.undo();
      expect(onRestore).toHaveBeenLastCalledWith(0, 'after reset');
    });

    it('message is omitted (undefined) when getMessage is not provided', () => {
      const onRestore = vi.fn();
      const { result } = withSetup(() => useVizHistory<number>(0, { onRestore }));
      result.commit(1);
      result.undo();
      expect(onRestore).toHaveBeenLastCalledWith(0, undefined);
    });
  });
});
