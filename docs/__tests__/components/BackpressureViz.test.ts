import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import BackpressureViz from '../../.vitepress/theme/components/BackpressureViz.vue';
import { clickReset, clickButton } from '../helpers/viz-interactions';

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

  it('defaults to the Block strategy and exposes a strategy toggle', () => {
    // Semantic alignment with the pattern body: Block is the primary,
    // lossless strategy ("producer waits until buffer has space"); Drop is
    // the lossy opt-in. The component must default to Block.
    const wrapper = mount(BackpressureViz);
    expect(wrapper.find('.bp-strategy').exists()).toBe(true);
    // Block strategy shows a "Blocked" stat, not "Dropped".
    expect(wrapper.find('.bp-stat-block').exists()).toBe(true);
    expect(wrapper.find('.bp-stat-drop').exists()).toBe(false);
  });

  it('Block strategy makes the producer wait when full — never drops (semantic alignment)', async () => {
    // Regression for the viz-vs-body semantic audit: the pattern defines
    // backpressure as slowing/blocking the producer (lossless), NOT dropping.
    // Drive a fast producer with no consumer; once the 12-slot queue fills,
    // the producer must BLOCK (waiting state + Blocked count), and nothing
    // may be dropped.
    const wrapper = mount(BackpressureViz);
    await clickButton(wrapper, ['Start Producer', '启动生产者']);

    // producer rate 3/s → 1 tick per ~333ms; run well past filling 12 slots.
    await vi.advanceTimersByTimeAsync(8000);
    await wrapper.vm.$nextTick();

    // Queue is capped at 12, producer is shown as waiting, and the Block
    // counter is non-zero. Crucially, the Dropped path was never taken.
    const queueLabel = wrapper.find('.bp-queue-label').text();
    expect(queueLabel).toContain('12/12');
    expect(wrapper.find('.bp-actor-waiting').exists()).toBe(true);
    expect(wrapper.find('.bp-stat-drop').exists()).toBe(false); // still Block strategy
    // The Blocked stat shows a positive count (producer waited at least once).
    const blockStat = wrapper.find('.bp-stat-block').text();
    expect(blockStat).not.toMatch(/\b0\b/);
  });

  it('Drop strategy discards when full (lossy opt-in)', async () => {
    const wrapper = mount(BackpressureViz);
    await clickButton(wrapper, ['Drop (lossy)', '丢弃（有损）']);
    await clickButton(wrapper, ['Start Producer', '启动生产者']);

    await vi.advanceTimersByTimeAsync(8000);
    await wrapper.vm.$nextTick();

    // In Drop mode the Dropped stat is shown and grows; no waiting state.
    expect(wrapper.find('.bp-stat-drop').exists()).toBe(true);
    expect(wrapper.find('.bp-stat-block').exists()).toBe(false);
    const dropStat = wrapper.find('.bp-stat-drop').text();
    expect(dropStat).not.toMatch(/\b0\b/);
  });
});
