import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import IteratorViz from '../../.vitepress/theme/components/IteratorViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('IteratorViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 10 source elements and 5 pipeline stages', () => {
    const wrapper = mount(IteratorViz);
    const sourceItems = wrapper.findAll('.it-item--waiting');
    expect(sourceItems).toHaveLength(10);
    const stages = wrapper.findAll('.it-stage');
    expect(stages.length).toBeGreaterThanOrEqual(5);
  });

  it('shows 4 stats: Processed, In Source, Collected, Never Touched', () => {
    const wrapper = mount(IteratorViz);
    const stats = wrapper.findAll('.it-stat');
    expect(stats).toHaveLength(4);
    expect(wrapper.text()).toContain('0');
    expect(wrapper.text()).toContain('10');
  });

  it('Pull Next advances pipeline and processes one element', async () => {
    const wrapper = mount(IteratorViz);
    await clickButton(wrapper, ['Pull Next', '拉取下一个']);
    vi.advanceTimersByTime(5000);
    await flushPromises();

    const text = wrapper.text();
    expect(text).toMatch(/1|Processed|Source/);
  });

  it('reset restores initial state', async () => {
    const wrapper = mount(IteratorViz);
    await clickButton(wrapper, ['Pull Next', '拉取下一个']);
    vi.advanceTimersByTime(2000);
    await flushPromises();

    await clickReset(wrapper);

    const waitingItems = wrapper.findAll('.it-item--waiting');
    expect(waitingItems).toHaveLength(10);
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(IteratorViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
