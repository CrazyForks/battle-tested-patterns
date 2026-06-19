import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DiffPatchViz from '../../.vitepress/theme/components/DiffPatchViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('DiffPatchViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders original and modified panels', () => {
    const wrapper = mount(DiffPatchViz);
    const panels = wrapper.findAll('.dp-panel');
    expect(panels).toHaveLength(2);
  });

  it('original panel has lines', () => {
    const wrapper = mount(DiffPatchViz);
    const lines = wrapper.findAll('.dp-line');
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it('modify then diff produces diff output', async () => {
    const wrapper = mount(DiffPatchViz);
    await clickButton(wrapper, ['Modify', '修改']);

    await clickButton(wrapper, 'Diff');
    vi.advanceTimersByTime(1000);
    await flushPromises();

    expect(wrapper.find('.dp-diff').exists()).toBe(true);
  });

  it('reset clears diff output', async () => {
    const wrapper = mount(DiffPatchViz);
    await clickReset(wrapper);

    expect(wrapper.find('.dp-diff').exists()).toBe(false);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(DiffPatchViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });

  it('modify records a time-travel step (regression: modify must commit)', async () => {
    const wrapper = mount(DiffPatchViz);
    // Before any write the playback bar is hidden (only the initial snapshot).
    expect(wrapper.find('.viz-playback__counter').exists()).toBe(false);

    await clickButton(wrapper, ['Modify', '修改']);
    await flushPromises();

    // modify() changes modifiedLines/diffResult/hasDiff/patched — it must commit
    // so the edited state is reachable via time travel (counter shows 2/2).
    const counter = wrapper.find('.viz-playback__counter');
    expect(counter.exists()).toBe(true);
    expect(counter.text()).toBe('2/2');
  });

  it('uses a greedy forward scan, not LCS (semantic alignment with the pattern body)', async () => {
    // Regression for the viz-vs-body semantic audit: the pattern's
    // Implementation section documents a greedy forward scan ("not a
    // guaranteed-minimal edit script"). The component must demonstrate THAT
    // algorithm — never claim LCS / minimum edit distance.
    const wrapper = mount(DiffPatchViz);

    // "Minimal Change" preset renames a parameter on line 1; lines 2-4 unchanged.
    // Greedy scan: line 1 mismatches → delete old[0], insert new[0]; then 3 keeps.
    await clickButton(wrapper, ['Minimal Change', '最小改动']);
    await vi.advanceTimersByTimeAsync(2000);
    await flushPromises();

    const diffLines = wrapper.findAll('.dp-diff-line');
    const adds = diffLines.filter((l) => l.classes().includes('dp-diff-line--add'));
    const dels = diffLines.filter((l) => l.classes().includes('dp-diff-line--del'));
    // 1 deletion + 1 insertion + 3 unchanged = 5 rows total.
    expect(dels).toHaveLength(1);
    expect(adds).toHaveLength(1);
    expect(diffLines).toHaveLength(5);

    // The narration must describe the greedy scan, never LCS / minimum edit.
    const status = wrapper.find('.viz-status').text();
    expect(status).not.toMatch(/LCS|Longest Common|minimum edit|最小编辑/);
  });
});
