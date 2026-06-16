import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ObjectPoolViz from '../../.vitepress/theme/components/ObjectPoolViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('ObjectPoolViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial pool of 5 objects', () => {
    const wrapper = mount(ObjectPoolViz);
    const cards = wrapper.findAll('.op-card');
    expect(cards).toHaveLength(5);
  });

  it('all objects start as available', () => {
    const wrapper = mount(ObjectPoolViz);
    const available = wrapper.findAll('.op-card--available');
    expect(available).toHaveLength(5);
  });

  it('acquire marks an object as in-use', async () => {
    const wrapper = mount(ObjectPoolViz);
    await clickButton(wrapper, ['Acquire', '获取']);

    const inUse = wrapper.findAll('.op-card--in-use');
    expect(inUse).toHaveLength(1);
  });

  it('reset restores all objects to available', async () => {
    const wrapper = mount(ObjectPoolViz);
    await clickButton(wrapper, ['Acquire', '获取']);

    await clickReset(wrapper);

    const available = wrapper.findAll('.op-card--available');
    expect(available).toHaveLength(5);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(ObjectPoolViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });

  it('grow pool records a time-travel step (regression: growPool must commit)', async () => {
    const wrapper = mount(ObjectPoolViz);
    // Before any write the playback bar is hidden (only the initial snapshot).
    expect(wrapper.find('.viz-playback__counter').exists()).toBe(false);

    await clickButton(wrapper, ['Grow Pool +2', '扩容 +2']);

    // After growing, the bar appears and the counter shows step 2 of 2
    // (initial snapshot + the grow snapshot) — proving growPool committed.
    const counter = wrapper.find('.viz-playback__counter');
    expect(counter.exists()).toBe(true);
    expect(counter.text()).toBe('2/2');
  });
});
