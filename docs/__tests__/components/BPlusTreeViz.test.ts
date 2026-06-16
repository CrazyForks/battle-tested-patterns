import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BPlusTreeViz from '../../.vitepress/theme/components/BPlusTreeViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('BPlusTreeViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG tree visualization', () => {
    const wrapper = mount(BPlusTreeViz);
    expect(wrapper.find('.bptree-svg').exists()).toBe(true);
  });

  it('insert button adds a key to the tree', async () => {
    const wrapper = mount(BPlusTreeViz);
    await clickButton(wrapper, ['Insert Random', '随机插入']);
    vi.advanceTimersByTime(1000);
    await flushPromises();

    const status = wrapper.find('.viz-status');
    expect(status.text().length).toBeGreaterThan(0);
  });

  it('reset clears the tree', async () => {
    const wrapper = mount(BPlusTreeViz);
    await clickButton(wrapper, ['Insert Random', '随机插入']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    await clickReset(wrapper);

    const status = wrapper.find('.viz-status');
    expect(status.exists()).toBe(true);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(BPlusTreeViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });

  it('load demo records a time-travel step (regression: loadDemo must commit)', async () => {
    const wrapper = mount(BPlusTreeViz);
    // Before any write the playback bar is hidden (only the initial snapshot).
    expect(wrapper.find('.viz-playback__counter').exists()).toBe(false);

    await clickButton(wrapper, ['Demo', '示例']);
    await flushPromises();

    // loadDemo resets history then inserts 9 keys; it must commit one snapshot
    // so the loaded tree is reachable via time travel (counter shows 2/2).
    const counter = wrapper.find('.viz-playback__counter');
    expect(counter.exists()).toBe(true);
    expect(counter.text()).toBe('2/2');
  });
});
