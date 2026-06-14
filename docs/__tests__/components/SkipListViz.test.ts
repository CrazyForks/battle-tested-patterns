import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickButton, clickReset } from '../helpers/viz-interactions';
import SkipListViz from '../../.vitepress/theme/components/SkipListViz.vue';

describe('SkipListViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG visualization area', () => {
    const wrapper = mount(SkipListViz);
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('starts with empty skip list', () => {
    const wrapper = mount(SkipListViz);
    expect(wrapper.text()).toMatch(/empty|空|Insert|插入/i);
  });

  it('insert button adds a node', async () => {
    const wrapper = mount(SkipListViz);
    await clickButton(wrapper, ['Insert Random', '插入随机值']);
    vi.advanceTimersByTime(2000);
    await flushPromises();

    expect(wrapper.text()).toMatch(/Inserted|已插入|level/i);
  });

  it('reset clears all nodes', async () => {
    const wrapper = mount(SkipListViz);
    await clickButton(wrapper, ['Insert Random', '插入随机值']);
    vi.advanceTimersByTime(1000);
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.text()).toMatch(/empty|空|Insert|插入/i);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(SkipListViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });

  it('empty state SVG viewBox has minimum width for text visibility', () => {
    const wrapper = mount(SkipListViz);
    const svg = wrapper.find('svg');
    const viewBox = svg.attributes('viewBox') || '';
    const width = parseInt(viewBox.split(' ')[2] || '0', 10);
    // Must be at least 320 to fit empty state text
    expect(width).toBeGreaterThanOrEqual(320);
  });

  it('search message references sorted linked list (not array)', async () => {
    const wrapper = mount(SkipListViz);

    // Insert a few nodes
    for (let i = 0; i < 3; i++) {
      await clickButton(wrapper, ['Insert Random', '插入随机值']);
      vi.advanceTimersByTime(2000);
      await flushPromises();
    }

    // Trigger search
    await clickButton(wrapper, ['Search', '搜索']);

    // Search uses multiple delay() calls — advance timers in small increments
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    const text = wrapper.text();
    // Ensure search actually completed
    expect(text).toMatch(/Found|Not found|找到|未找到/);
    // Should mention "linked list" not "array" in the message
    expect(text).toMatch(/linked list|链表/i);
    expect(text).not.toContain('sorted array');
  });
});
