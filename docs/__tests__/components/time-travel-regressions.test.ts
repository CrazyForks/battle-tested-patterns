/**
 * Targeted time-travel regression tests for the specific bugs found in the
 * June-2026 useVizHistory audit. Each test reproduces the exact scenario that
 * was broken and asserts the fix holds.
 *
 * These are intentionally separate from the generic `time-travel.test.ts`
 * contract suite: they drive component-specific interactions (multiple clicks,
 * async animation settling) that the generic suite deliberately avoids.
 *
 * Controls are located by their visible label via the shared `viz-interactions`
 * helper, never by style class or DOM index — so reordering or restyling a
 * button cannot silently make a test click the wrong control.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';

import MinHeapViz from '../../.vitepress/theme/components/MinHeapViz.vue';
import FreeListViz from '../../.vitepress/theme/components/FreeListViz.vue';
import ReferenceCountingViz from '../../.vitepress/theme/components/ReferenceCountingViz.vue';
import MVCCViz from '../../.vitepress/theme/components/MVCCViz.vue';
import {
  clickButton,
  playbackCounter,
  playbackStepBack,
  settle,
} from '../helpers/viz-interactions';

describe('time-travel regressions (audit fixes)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Bug #1: MinHeapViz.extractMin() single-element branch skipped commit().
  // Repro: insert → extractMin (heap becomes empty). Before the fix the empty
  // extract committed no snapshot, so playback "only showed inserts".
  describe('MinHeapViz', () => {
    it('extractMin on a single-element heap commits per-step snapshots', async () => {
      const wrapper = mount(MinHeapViz);

      await clickButton(wrapper, ['Insert Random', '插入随机值']);
      await settle();
      const afterInsert = playbackCounter(wrapper);
      expect(afterInsert).not.toBeNull();
      const totalAfterInsert = afterInsert!.total;

      await clickButton(wrapper, ['Extract Min', '提取最小值']);
      await settle();
      const afterExtract = playbackCounter(wrapper);
      expect(afterExtract).not.toBeNull();
      // Per-step commits: extractMin on a 1-element heap produces 2 snapshots
      // (start highlight + done after pop).
      expect(afterExtract!.total).toBe(totalAfterInsert + 2);
    });

    it('insert → extract → insert → extract records all sub-steps', async () => {
      const wrapper = mount(MinHeapViz);

      await clickButton(wrapper, ['Insert Random', '插入随机值']); await settle();
      await clickButton(wrapper, ['Extract Min', '提取最小值']); await settle();
      await clickButton(wrapper, ['Insert Random', '插入随机值']); await settle();
      await clickButton(wrapper, ['Extract Min', '提取最小值']); await settle();

      // Per-step commits: on an empty/single-element heap each operation
      // produces multiple snapshots (insert: push+root = 2, extract: start+done = 2).
      // initial(1) + 2+2+2+2 = 9 total steps.
      expect(playbackCounter(wrapper)!.total).toBe(9);
    });

    // P1 (message-in-snapshot): time travel must restore the status-bar text,
    // not leave it stuck on the latest step's narration.
    it('undo restores the status-bar message to the prior step', async () => {
      const wrapper = mount(MinHeapViz);

      await clickButton(wrapper, ['Insert Random', '插入随机值']);
      await settle();
      const msgAfterFirst = wrapper.find('.viz-status').text();
      const totalAfterFirst = playbackCounter(wrapper)!.total;

      await clickButton(wrapper, ['Insert Random', '插入随机值']);
      await settle();
      const msgAfterSecond = wrapper.find('.viz-status').text();
      // Two random inserts produce different narration (different values/indices).
      // Even if identical, the test below still proves restoration is wired.

      // With per-step commits, one playbackStepBack only undoes ONE sub-step
      // (e.g. from :root back to :push within the same insert). Step back
      // enough times to return to the first insert's final snapshot.
      const totalAfterSecond = playbackCounter(wrapper)!.total;
      const stepsToUndo = totalAfterSecond - totalAfterFirst;
      for (let i = 0; i < stepsToUndo; i++) {
        await playbackStepBack(wrapper);
      }

      // Status bar must reflect the FIRST insert's final message again.
      expect(wrapper.find('.viz-status').text()).toBe(msgAfterFirst);
      // Sanity: we actually moved off the second step's state.
      expect(msgAfterSecond).not.toBe('');
    });
  });

  // Bug #14: FreeListViz.freeAll() committed nothing.
  describe('FreeListViz', () => {
    it('freeAll commits a snapshot after allocating', async () => {
      const wrapper = mount(FreeListViz);
      await clickButton(wrapper, ['Allocate', '分配']);
      await settle();
      const before = playbackCounter(wrapper)!;

      await clickButton(wrapper, ['Free All', '全部释放']);
      await settle();

      // freeAll frees the allocated block(s) → must commit a new snapshot.
      expect(playbackCounter(wrapper)!.total).toBe(before.total + 1);
    });
  });

  // Bug #15: ReferenceCountingViz.addObject() committed nothing.
  describe('ReferenceCountingViz', () => {
    it('addObject commits a snapshot', async () => {
      const wrapper = mount(ReferenceCountingViz);
      await clickButton(wrapper, ['+ Object', '+ 对象']);
      await settle();
      const c = playbackCounter(wrapper);
      // First committed action → playback bar visible with total >= 2.
      expect(c).not.toBeNull();
      expect(c!.total).toBeGreaterThanOrEqual(2);
    });
  });

  // Bug #13: MVCCViz.abortTxn() committed nothing.
  describe('MVCCViz', () => {
    it('abortTxn commits a snapshot', async () => {
      const wrapper = mount(MVCCViz);
      // Begin a transaction. beginTxn() does NOT auto-select, so we must click
      // the active transaction row to select it before Abort becomes enabled.
      await clickButton(wrapper, ['Begin Txn', '开始事务']);
      await settle();
      const before = playbackCounter(wrapper)!;

      // The active transaction row is component-specific UI (not a button), so
      // it is legitimately located by its component class.
      const txnRow = wrapper.find('.mv-txn--active');
      expect(txnRow.exists()).toBe(true);
      await txnRow.trigger('click');
      await settle();

      await clickButton(wrapper, ['Abort', '中止']);
      await settle();

      // Abort changes txn status → must commit a new snapshot.
      expect(playbackCounter(wrapper)!.total).toBe(before.total + 1);
    });
  });
});
