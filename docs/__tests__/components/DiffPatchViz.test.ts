import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DiffPatchViz from '../../.vitepress/theme/components/DiffPatchViz.vue';

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
    const modifyBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Modify') || b.text().includes('修改'),
    );
    await modifyBtn!.trigger('click');
    await flushPromises();

    const diffBtn = wrapper.find('.viz-btn--primary');
    await diffBtn.trigger('click');
    vi.advanceTimersByTime(1000);
    await flushPromises();

    expect(wrapper.find('.dp-diff').exists()).toBe(true);
  });

  it('reset clears diff output', async () => {
    const wrapper = mount(DiffPatchViz);
    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.find('.dp-diff').exists()).toBe(false);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(DiffPatchViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
