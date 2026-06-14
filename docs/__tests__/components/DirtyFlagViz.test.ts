import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DirtyFlagViz from '../../.vitepress/theme/components/DirtyFlagViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('DirtyFlagViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG with entity circles', () => {
    const wrapper = mount(DirtyFlagViz);
    const svg = wrapper.find('.df-svg');
    expect(svg.exists()).toBe(true);
    const circles = wrapper.findAll('circle[role="button"]');
    expect(circles).toHaveLength(3);
  });

  it('clicking an entity marks it dirty', async () => {
    const wrapper = mount(DirtyFlagViz);
    const circle = wrapper.find('circle[role="button"]');
    await circle.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('DIRTY');
  });

  it('recompute clears dirty flags', async () => {
    const wrapper = mount(DirtyFlagViz);
    const circle = wrapper.find('circle[role="button"]');
    await circle.trigger('click');
    await flushPromises();

    await clickButton(wrapper, ['Recompute (dirty only)', '重算（仅脏数据）']);

    expect(wrapper.text()).toMatch(/Skipped|跳过/);
  });

  it('reset restores initial state', async () => {
    const wrapper = mount(DirtyFlagViz);
    const circle = wrapper.find('circle[role="button"]');
    await circle.trigger('click');
    await flushPromises();

    await clickReset(wrapper);

    const stats = wrapper.find('.df-stats');
    expect(stats.exists()).toBe(true);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(DirtyFlagViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
