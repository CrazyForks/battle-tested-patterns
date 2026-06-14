import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BatchProcessingViz from '../../.vitepress/theme/components/BatchProcessingViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

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
    await clickButton(wrapper, ['Add Item', '添加元素']);

    const filled = wrapper.findAll('.bp-slot--filled');
    expect(filled).toHaveLength(1);
  });

  it('auto-flushes when buffer reaches threshold of 5', async () => {
    const wrapper = mount(BatchProcessingViz);

    for (let i = 0; i < 5; i++) {
      await clickButton(wrapper, ['Add Item', '添加元素']);
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

    for (let i = 0; i < 3; i++) {
      await clickButton(wrapper, ['Add Item', '添加元素']);
    }

    await clickButton(wrapper, ['Force Flush', '强制刷新']);
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
    await clickButton(wrapper, ['Add Item', '添加元素']);

    await clickReset(wrapper);

    expect(wrapper.findAll('.bp-slot--filled')).toHaveLength(0);
    expect(wrapper.findAll('.bp-batch')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(BatchProcessingViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
