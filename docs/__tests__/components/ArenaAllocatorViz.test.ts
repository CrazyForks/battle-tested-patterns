import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ArenaAllocatorViz from '../../.vitepress/theme/components/ArenaAllocatorViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('ArenaAllocatorViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with 1 arena block', () => {
    const wrapper = mount(ArenaAllocatorViz);
    const blocks = wrapper.findAll('.arena-block');
    expect(blocks).toHaveLength(1);
  });

  it('has stats showing used, free, total, allocations, arenas', () => {
    const wrapper = mount(ArenaAllocatorViz);
    const stats = wrapper.findAll('.arena-stat');
    expect(stats).toHaveLength(5);
  });

  it('allocate button creates an allocation in the arena', async () => {
    const wrapper = mount(ArenaAllocatorViz);
    await clickButton(wrapper, ['Allocate', '分配']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    const text = wrapper.text();
    expect(text).toMatch(/1/);
  });

  it('reset clears all allocations', async () => {
    const wrapper = mount(ArenaAllocatorViz);
    await clickButton(wrapper, ['Allocate', '分配']);

    await clickReset(wrapper);

    const blocks = wrapper.findAll('.arena-block');
    expect(blocks).toHaveLength(1);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(ArenaAllocatorViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
