import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import FreeListViz from '../../.vitepress/theme/components/FreeListViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('FreeListViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 10 blocks, all free initially', () => {
    const wrapper = mount(FreeListViz);
    const blocks = wrapper.findAll('.fl-block');
    expect(blocks).toHaveLength(10);
    const free = wrapper.findAll('.fl-block--free');
    expect(free).toHaveLength(10);
  });

  it('allocate marks a block as allocated', async () => {
    const wrapper = mount(FreeListViz);
    await clickButton(wrapper, ['Allocate', '分配']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    const allocated = wrapper.findAll('.fl-block--allocated');
    expect(allocated).toHaveLength(1);
  });

  it('has stats showing total, allocated, free, and head', () => {
    const wrapper = mount(FreeListViz);
    const stats = wrapper.findAll('.fl-stat');
    expect(stats).toHaveLength(4);
  });

  it('reset restores all blocks to free', async () => {
    const wrapper = mount(FreeListViz);
    await clickButton(wrapper, ['Allocate', '分配']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.findAll('.fl-block--allocated')).toHaveLength(0);
    expect(wrapper.findAll('.fl-block--free')).toHaveLength(10);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(FreeListViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
