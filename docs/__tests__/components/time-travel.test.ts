/**
 * Universal time-travel regression suite for the interactive Viz components.
 *
 * Why this exists:
 * A June-2026 audit of `useVizHistory` integration found systemic time-travel
 * bugs (missing commits, incomplete onRestore, orphaned timers, preset locks).
 * This suite codifies the cross-component contract so the bugs cannot recur.
 *
 * Scope note:
 * Components differ widely in how their first action is triggered — many require
 * typing into an input before a snapshot is committed (e.g. BloomFilter.add,
 * LRUCache.put, Trie.insertWord), and a few primary buttons are read-only demos
 * (e.g. BitmaskViz.testOp). So this suite only asserts the *truly universal*
 * contract that every VizPlaybackBar component must satisfy regardless of its
 * domain logic:
 *
 *   1. Mounts without throwing; playback bar hidden at initial state
 *      (progressive disclosure), except components that seed demo state in
 *      setup() and therefore commit on mount.
 *   2. Reset returns history to a single step (history.reset() ran).
 *   3. Unmounting mid-action does not throw (onUnmounted timer cleanup is safe).
 *
 * Controls are located by visible label / accessible name via the shared
 * `viz-interactions` helper. The only remaining class-based lookup is the
 * "first action" entry button, which is a best-effort trigger (some components
 * legitimately no-op without input) — see FIRST_ACTION below.
 *
 * Per-component commit/undo/redo/onRestore correctness — including the exact
 * bugs found in the audit — is asserted in `time-travel-regressions.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import {
  clickReset,
  playbackVisible,
  settle,
} from '../helpers/viz-interactions';

function nameFromPath(path: string): string {
  return path.split('/').pop()!.replace('.vue', '');
}

// All *Viz.vue components.
const allModules = import.meta.glob('../../.vitepress/theme/components/*Viz.vue');

// Static pattern-navigation components that match the *Viz.vue glob but are NOT
// interactive time-travel components (no VizPlaybackBar, no useVizHistory).
// They use VitePress `withBase`, unavailable in the test environment.
const NON_INTERACTIVE = new Set<string>([
  'PatternConnectionsViz',
  'PatternTimelineViz',
]);

// Components that commit a snapshot during setup (pre-populated demo state), so
// their playback bar is visible immediately on mount — by design, not a bug.
const COMMITS_ON_MOUNT = new Set<string>([
  'FlyweightViz', // setup() calls applyText() which commits "Hello Flyweight"
]);

// Best-effort first-action entry button per component. Most use the primary
// action button; a few need a different entry. This is the ONE place a class
// selector is acceptable: a miss here is harmless (the test only needs *a*
// first action to reveal the playback bar, and falls back gracefully).
const FIRST_ACTION_SELECTOR: Record<string, string> = {
  LogicalClockViz: '.lc-btn',
};
const DEFAULT_FIRST_ACTION = '.viz-btn--primary';

const modules = Object.fromEntries(
  Object.entries(allModules).filter(
    ([path]) => !NON_INTERACTIVE.has(nameFromPath(path)),
  ),
);

/** Trigger a best-effort first action to reveal the playback bar. */
async function triggerFirstAction(wrapper: ReturnType<typeof mount>, name: string) {
  const selector = FIRST_ACTION_SELECTOR[name] ?? DEFAULT_FIRST_ACTION;
  const btn = wrapper.find(selector);
  if (btn.exists()) {
    await btn.trigger('click');
    await settle();
  }
}

describe('time-travel contract (VizPlaybackBar components)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  for (const [path, loader] of Object.entries(modules)) {
    const name = nameFromPath(path);

    describe(name, () => {
      it('mounts without throwing; playback bar hidden initially', async () => {
        const mod = (await loader()) as { default: unknown };
        const wrapper = mount(mod.default as never);
        if (!COMMITS_ON_MOUNT.has(name)) {
          expect(playbackVisible(wrapper)).toBe(false);
        }
        wrapper.unmount();
      });

      it('exposes a reset control that restores initial history', async () => {
        const mod = (await loader()) as { default: unknown };
        const wrapper = mount(mod.default as never);

        await triggerFirstAction(wrapper, name);

        // Reset is located by label (never by .viz-btn--danger, which is also
        // used for Abort/Crash/Tamper/Send Failure in several components).
        const didReset = await clickReset(wrapper);
        expect(didReset).toBe(true);
        await settle();

        // After history.reset(), totalSteps === 1 → bar hidden again.
        // COMMITS_ON_MOUNT components re-seed on reset, so allow either.
        if (!COMMITS_ON_MOUNT.has(name)) {
          expect(playbackVisible(wrapper)).toBe(false);
        }
        wrapper.unmount();
      });

      it('unmount mid-action does not throw (timer cleanup safe)', async () => {
        const mod = (await loader()) as { default: unknown };
        const wrapper = mount(mod.default as never);
        const selector = FIRST_ACTION_SELECTOR[name] ?? DEFAULT_FIRST_ACTION;
        const btn = wrapper.find(selector);
        if (btn.exists()) await btn.trigger('click');
        await flushPromises();
        // Unmount mid-animation; pending timers must be cleared by onUnmounted.
        expect(() => wrapper.unmount()).not.toThrow();
        vi.advanceTimersByTime(5000);
      });
    });
  }
});
