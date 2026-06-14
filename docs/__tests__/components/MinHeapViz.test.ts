import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MinHeapViz from '../../.vitepress/theme/components/MinHeapViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('MinHeapViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG tree area and controls', () => {
    const wrapper = mount(MinHeapViz);
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.find('.viz-controls').exists()).toBe(true);
  });

  it('starts with empty heap (no circle nodes)', () => {
    const wrapper = mount(MinHeapViz);
    const circles = wrapper.findAll('svg circle');
    expect(circles).toHaveLength(0);
  });

  it('insert button adds a node to the heap', async () => {
    const wrapper = mount(MinHeapViz);
    await clickButton(wrapper, ['Insert Random', '插入随机值']);

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    const circles = wrapper.findAll('svg circle');
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears the heap', async () => {
    const wrapper = mount(MinHeapViz);
    await clickButton(wrapper, ['Insert Random', '插入随机值']);

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    await clickReset(wrapper);

    const circles = wrapper.findAll('svg circle');
    expect(circles).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(MinHeapViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
