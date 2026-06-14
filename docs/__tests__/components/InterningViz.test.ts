import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import InterningViz from '../../.vitepress/theme/components/InterningViz.vue';
import { clickReset } from '../helpers/viz-interactions';

describe('InterningViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty pool and no variables', () => {
    const wrapper = mount(InterningViz);
    expect(wrapper.findAll('.in-entry')).toHaveLength(0);
    expect(wrapper.findAll('.in-var')).toHaveLength(0);
  });

  it('has stats section', () => {
    const wrapper = mount(InterningViz);
    const stats = wrapper.findAll('.in-stat');
    expect(stats.length).toBeGreaterThanOrEqual(2);
  });

  it('has quick-add preset buttons', () => {
    const wrapper = mount(InterningViz);
    const presetBtns = wrapper.findAll('.in-preset-btn');
    expect(presetBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking a preset string interns it into the pool', async () => {
    const wrapper = mount(InterningViz);
    const presetBtns = wrapper.findAll('.in-preset-btn');
    await presetBtns[0].trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.in-entry')).toHaveLength(1);
    expect(wrapper.findAll('.in-var')).toHaveLength(1);
  });

  it('interning same string twice reuses pool entry', async () => {
    const wrapper = mount(InterningViz);
    const presetBtns = wrapper.findAll('.in-preset-btn');
    await presetBtns[0].trigger('click');
    await flushPromises();
    await presetBtns[0].trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.in-entry')).toHaveLength(1);
    expect(wrapper.findAll('.in-var')).toHaveLength(2);
  });

  it('reset clears pool and variables', async () => {
    const wrapper = mount(InterningViz);
    const presetBtns = wrapper.findAll('.in-preset-btn');
    await presetBtns[0].trigger('click');
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.findAll('.in-entry')).toHaveLength(0);
    expect(wrapper.findAll('.in-var')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(InterningViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
