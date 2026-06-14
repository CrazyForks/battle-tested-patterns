import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import BackpressureViz from '../../.vitepress/theme/components/BackpressureViz.vue';
import { clickReset } from '../helpers/viz-interactions';

describe('BackpressureViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders producer and consumer actors', () => {
    const wrapper = mount(BackpressureViz);
    expect(wrapper.find('.bp-producer').exists()).toBe(true);
    expect(wrapper.find('.bp-consumer').exists()).toBe(true);
  });

  it('renders queue with 12 slots', () => {
    const wrapper = mount(BackpressureViz);
    const slots = wrapper.findAll('.bp-slot');
    expect(slots).toHaveLength(12);
  });

  it('starts with empty stats', () => {
    const wrapper = mount(BackpressureViz);
    const stats = wrapper.find('.bp-stats');
    expect(stats.exists()).toBe(true);
    expect(stats.text()).toContain('0');
  });

  it('has producer and consumer rate sliders', () => {
    const wrapper = mount(BackpressureViz);
    const sliders = wrapper.findAll('.bp-rate-slider');
    expect(sliders).toHaveLength(2);
  });

  it('reset clears queue and stats', async () => {
    const wrapper = mount(BackpressureViz);
    await clickReset(wrapper);

    const filledSlots = wrapper.findAll('.bp-slot--filled');
    expect(filledSlots).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(BackpressureViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
