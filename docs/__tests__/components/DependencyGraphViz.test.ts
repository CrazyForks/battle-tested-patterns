import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DependencyGraphViz from '../../.vitepress/theme/components/DependencyGraphViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('DependencyGraphViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG dependency graph', () => {
    const wrapper = mount(DependencyGraphViz);
    expect(wrapper.find('.depgraph-svg').exists()).toBe(true);
  });

  it('topo sort button produces sorted order', async () => {
    const wrapper = mount(DependencyGraphViz);
    await clickButton(wrapper, ['Topo Sort', '拓扑排序']);
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(200);
      await flushPromises();
    }

    const orderItems = wrapper.findAll('.dg-order-item');
    expect(orderItems.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears sorted order', async () => {
    const wrapper = mount(DependencyGraphViz);
    await clickReset(wrapper);

    expect(wrapper.findAll('.dg-order-item')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(DependencyGraphViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
