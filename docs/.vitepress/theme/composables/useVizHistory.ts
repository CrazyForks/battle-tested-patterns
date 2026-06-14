import { ref, computed, watch, onUnmounted, type ComputedRef, type Ref } from 'vue';

export interface VizHistoryEntry<T> {
  state: T;
  label: string;
  /**
   * Optional status-bar message captured at commit time. Lets time travel
   * faithfully restore the per-step narration shown in the `.viz-status` bar.
   * Populated automatically when `getMessage` is provided in options.
   */
  message?: string;
}

export interface VizHistoryOptions<T = unknown> {
  /** Maximum number of history entries. Default: 200. */
  maxHistory?: number;
  /** Custom clone function. Default: JSON round-trip. */
  clone?: <V>(v: V) => V;
  /**
   * Called when the user navigates history (undo/redo/goto/play).
   * Receives the restored state snapshot — component applies it to its reactive data.
   * The second argument is the status-bar message captured at the restored
   * step (present only when `getMessage` was provided at commit time), so the
   * component can restore its `.viz-status` text to match the historical step.
   * When provided, the composable auto-watches currentIndex changes from PlaybackBar,
   * eliminating the need for manual watch + skipWatch boilerplate in each component.
   */
  onRestore?: (state: T, message?: string) => void;
  /**
   * Captures the current status-bar message at commit/reset time. The returned
   * string is stored on the snapshot and handed back via `onRestore`, so the
   * status text travels with the state. Strings are immutable and small, so
   * they are stored by reference (not cloned).
   */
  getMessage?: () => string;
}

export interface VizHistory<T> {
  /** Whether undo is available (index > 0). */
  canUndo: ComputedRef<boolean>;
  /** Whether redo is available (index < last). */
  canRedo: ComputedRef<boolean>;
  /** Current position in history (0-based). */
  currentIndex: ComputedRef<number>;
  /** Total number of recorded steps. */
  totalSteps: ComputedRef<number>;
  /** Label of the current step. */
  currentLabel: ComputedRef<string>;

  /** Record a state snapshot. Truncates any redo history. */
  commit(state: T, label?: string): void;
  /** Go back one step. Returns the restored state or undefined if at start. */
  undo(): T | undefined;
  /** Go forward one step. Returns the restored state or undefined if at end. */
  redo(): T | undefined;
  /** Jump to a specific index. Returns the state at that index. */
  goto(index: number): T | undefined;
  /** Clear all history and reset to initial state. */
  reset(initialState?: T): void;

  /** Whether auto-play is active. */
  isPlaying: Ref<boolean>;
  /** Start auto-playing forward from current position. */
  play(): void;
  /** Pause auto-play. */
  pause(): void;
}

/**
 * Universal state history composable for Viz components.
 *
 * Implements the Memento Pattern: each user action commits a full state
 * snapshot. Undo/redo simply switches the index — no inverse operations needed.
 *
 * Designed for states <1KB (typical for all 48 Viz components). At maxHistory=200,
 * memory usage is bounded at ~200KB per component instance.
 *
 * Integration:
 * - Works with useVizTimers (speed ref controls play interval)
 * - Works with useVizLog (commit labels can be forwarded to log)
 * - Preset scenarios automatically enter the same history stack
 */
export function useVizHistory<T>(
  initialState: T,
  options: VizHistoryOptions<T> = {},
): VizHistory<T> {
  // Default clone uses JSON round-trip: safe for Vue Proxy-wrapped objects
  // and sufficient for <1KB states typical of all 48 Viz components.
  const defaultClone = <V>(v: V): V => JSON.parse(JSON.stringify(v));
  const { maxHistory = 200, clone = defaultClone, onRestore, getMessage } = options;

  const history = ref<VizHistoryEntry<T>[]>([
    // Initial snapshot intentionally omits getMessage(): it runs during component
    // setup, where the component's `message` ref may not be initialized yet
    // (declaration-order TDZ). The initial message is just a placeholder prompt,
    // so its absence is harmless. commit()/reset() capture messages safely
    // because they only run after setup, once all refs exist.
    { state: clone(initialState), label: 'initial' },
  ]) as Ref<VizHistoryEntry<T>[]>;
  const index = ref(0);
  const isPlaying = ref(false);
  let playTimerId: ReturnType<typeof setTimeout> | null = null;
  // Prevents onRestore from firing during commit() — avoids circular updates
  let skipRestore = false;

  const canUndo = computed(() => index.value > 0);
  const canRedo = computed(() => index.value < history.value.length - 1);
  const currentIndex = computed(() => index.value);
  const totalSteps = computed(() => history.value.length);
  const currentLabel = computed(() => history.value[index.value]?.label ?? '');

  function commit(state: T, label = ''): void {
    skipRestore = true;
    // Truncate any redo history (standard undo/redo behavior)
    if (index.value < history.value.length - 1) {
      history.value = history.value.slice(0, index.value + 1);
    }
    // Add new snapshot (message captured so the status bar can travel with it)
    history.value.push({ state: clone(state), label, message: getMessage?.() });
    // Enforce max history limit
    if (history.value.length > maxHistory) {
      history.value = history.value.slice(history.value.length - maxHistory);
    }
    index.value = history.value.length - 1;
    skipRestore = false;
  }

  function undo(): T | undefined {
    if (!canUndo.value) return undefined;
    index.value--;
    return clone(history.value[index.value]!.state);
  }

  function redo(): T | undefined {
    if (!canRedo.value) return undefined;
    index.value++;
    return clone(history.value[index.value]!.state);
  }

  function goto(targetIndex: number): T | undefined {
    if (targetIndex < 0 || targetIndex >= history.value.length) return undefined;
    index.value = targetIndex;
    return clone(history.value[index.value]!.state);
  }

  function reset(newInitialState?: T): void {
    pause();
    skipRestore = true;
    const initial = newInitialState !== undefined ? newInitialState : initialState;
    history.value = [{ state: clone(initial), label: 'initial', message: getMessage?.() }];
    index.value = 0;
    skipRestore = false;
  }

  function play(): void {
    if (isPlaying.value) return;
    if (!canRedo.value) {
      // If at end, restart from beginning
      index.value = 0;
    }
    isPlaying.value = true;
    scheduleNext();
  }

  function pause(): void {
    isPlaying.value = false;
    if (playTimerId) {
      clearTimeout(playTimerId);
      playTimerId = null;
    }
  }

  function scheduleNext(): void {
    if (!isPlaying.value) return;
    if (!canRedo.value) {
      isPlaying.value = false;
      return;
    }
    playTimerId = setTimeout(() => {
      playTimerId = null;
      if (!isPlaying.value) return;
      index.value++;
      scheduleNext();
    }, 800); // Base interval; components can override via useVizTimers speed
  }

  // Auto-watch: when onRestore is provided, watch index changes from PlaybackBar
  // (undo/redo/goto/play) and call onRestore with the cloned snapshot.
  // This eliminates the manual watch + skipWatch boilerplate in each component.
  if (onRestore) {
    watch(index, (newIdx) => {
      if (skipRestore) return;
      const entry = history.value[newIdx];
      if (entry) {
        skipRestore = true;
        onRestore(clone(entry.state), entry.message);
        skipRestore = false;
      }
    }, { flush: 'sync' });
  }

  onUnmounted(() => {
    if (playTimerId) {
      clearTimeout(playTimerId);
      playTimerId = null;
    }
  });

  return {
    canUndo,
    canRedo,
    currentIndex,
    totalSteps,
    currentLabel,
    commit,
    undo,
    redo,
    goto,
    reset,
    isPlaying,
    play,
    pause,
  };
}
