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
});
