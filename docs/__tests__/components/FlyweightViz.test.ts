import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import FlyweightViz from '../../.vitepress/theme/components/FlyweightViz.vue';

describe('FlyweightViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-initializes with "Hello Flyweight" creating pool chips and grid cells', () => {
    const wrapper = mount(FlyweightViz);
    const chips = wrapper.findAll('.fw-pool-chip');
    expect(chips.length).toBeGreaterThanOrEqual(1);
    const cells = wrapper.findAll('.fw-grid-cell');
    expect(cells).toHaveLength(15);
  });

  it('creates fewer flyweights than total instances (sharing works)', () => {
    const wrapper = mount(FlyweightViz);
    const chips = wrapper.findAll('.fw-pool-chip');
    const cells = wrapper.findAll('.fw-grid-cell');
    expect(chips.length).toBeLessThan(cells.length);
  });

  it('renders 4 stat cards showing metrics', () => {
    const wrapper = mount(FlyweightViz);
    const cards = wrapper.findAll('.fw-stat-card');
    expect(cards).toHaveLength(4);
  });

  it('has memory comparison showing savings', () => {
    const wrapper = mount(FlyweightViz);
    const compare = wrapper.find('.fw-memory-compare');
    expect(compare.exists()).toBe(true);
    const withoutSection = wrapper.find('.fw-mem-without');
    const withSection = wrapper.find('.fw-mem-with');
    expect(withoutSection.exists()).toBe(true);
    expect(withSection.exists()).toBe(true);
  });

  it('reset clears all instances and pool', async () => {
    const wrapper = mount(FlyweightViz);
    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.fw-pool-chip')).toHaveLength(0);
    expect(wrapper.findAll('.fw-grid-cell')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(FlyweightViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
