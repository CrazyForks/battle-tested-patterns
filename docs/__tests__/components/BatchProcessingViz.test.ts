import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BatchProcessingViz from '../../.vitepress/theme/components/BatchProcessingViz.vue';

describe('BatchProcessingViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 5 buffer slots, all empty initially', () => {
    const wrapper = mount(BatchProcessingViz);
    const slots = wrapper.findAll('.bp-slot');
    expect(slots).toHaveLength(5);
    const filled = wrapper.findAll('.bp-slot--filled');
    expect(filled).toHaveLength(0);
  });

  it('add item fills one slot', async () => {
    const wrapper = mount(BatchProcessingViz);
    const addBtn = wrapper.find('.viz-btn--primary');
    await addBtn.trigger('click');
    await flushPromises();

    const filled = wrapper.findAll('.bp-slot--filled');
    expect(filled).toHaveLength(1);
  });

  it('auto-flushes when buffer reaches threshold of 5', async () => {
    const wrapper = mount(BatchProcessingViz);
    const addBtn = wrapper.find('.viz-btn--primary');

    for (let i = 0; i < 5; i++) {
      await addBtn.trigger('click');
      await flushPromises();
    }

    vi.advanceTimersByTime(1000);
    await flushPromises();

    const batches = wrapper.findAll('.bp-batch');
    expect(batches).toHaveLength(1);
    const filled = wrapper.findAll('.bp-slot--filled');
    expect(filled).toHaveLength(0);
  });

  it('force flush processes partial buffer', async () => {
    const wrapper = mount(BatchProcessingViz);
    const addBtn = wrapper.find('.viz-btn--primary');

    for (let i = 0; i < 3; i++) {
      await addBtn.trigger('click');
      await flushPromises();
    }

    const flushBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Force Flush') || b.text().includes('强制刷新'),
    );
    await flushBtn!.trigger('click');
    vi.advanceTimersByTime(1000);
    await flushPromises();

    const batches = wrapper.findAll('.bp-batch');
    expect(batches).toHaveLength(1);
  });

  it('has stats section with total, batches, and avg', () => {
    const wrapper = mount(BatchProcessingViz);
    const stats = wrapper.find('.bp-stats');
    expect(stats.exists()).toBe(true);
    const statItems = wrapper.findAll('.bp-stat');
    expect(statItems).toHaveLength(3);
  });

  it('reset clears buffer and batches', async () => {
    const wrapper = mount(BatchProcessingViz);
    const addBtn = wrapper.find('.viz-btn--primary');
    await addBtn.trigger('click');
    await flushPromises();

    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.bp-slot--filled')).toHaveLength(0);
    expect(wrapper.findAll('.bp-batch')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(BatchProcessingViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
