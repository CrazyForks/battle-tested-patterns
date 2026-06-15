import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import MergeIteratorViz from '../../.vitepress/theme/components/MergeIteratorViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('MergeIteratorViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 3 iterators with sorted data', () => {
    const wrapper = mount(MergeIteratorViz);
    const rows = wrapper.findAll('.mi-row');
    expect(rows).toHaveLength(3);
    expect(wrapper.text()).toContain('Iter 1');
    expect(wrapper.text()).toContain('Iter 2');
    expect(wrapper.text()).toContain('Iter 3');
  });

  it('each iterator shows head indicator', () => {
    const wrapper = mount(MergeIteratorViz);
    const heads = wrapper.findAll('.mi-head-indicator');
    expect(heads).toHaveLength(3);
    expect(wrapper.text()).toContain('head=');
  });

  it('Next button picks minimum head and adds to output', async () => {
    const wrapper = mount(MergeIteratorViz);
    await clickButton(wrapper, ['Next', '下一个']);

    const outputCells = wrapper.findAll('.mi-cell--output');
    expect(outputCells).toHaveLength(1);
    expect(outputCells[0].text()).toBe('1'); // min of 1,2,3
  });

  it('consumed cells get crossed out after picking', async () => {
    const wrapper = mount(MergeIteratorViz);
    await clickButton(wrapper, ['Next', '下一个']);

    const consumed = wrapper.findAll('.mi-cell--consumed');
    expect(consumed).toHaveLength(1);
  });

  it('reset restores all iterators and clears output', async () => {
    const wrapper = mount(MergeIteratorViz);
    await clickButton(wrapper, ['Next', '下一个']);
    await clickButton(wrapper, ['Next', '下一个']);

    await clickReset(wrapper);

    expect(wrapper.findAll('.mi-cell--consumed')).toHaveLength(0);
    expect(wrapper.findAll('.mi-cell--output')).toHaveLength(0);
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(MergeIteratorViz);
    const presets = wrapper.find('.viz-presets');
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
