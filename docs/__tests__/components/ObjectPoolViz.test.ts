import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
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
});
