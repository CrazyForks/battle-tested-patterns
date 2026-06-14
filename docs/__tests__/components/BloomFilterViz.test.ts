import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BloomFilterViz from '../../.vitepress/theme/components/BloomFilterViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('BloomFilterViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders bit array with all zeros initially', () => {
    const wrapper = mount(BloomFilterViz);
    const bits = wrapper.findAll('.bloom-bit');
    expect(bits.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('0%');
  });

  it('add button inserts an item', async () => {
    const wrapper = mount(BloomFilterViz);
    const input = wrapper.find('.bloom-input');

    await input.setValue('hello');
    await clickButton(wrapper, ['Add', '添加']);

    vi.advanceTimersByTime(500);
    await flushPromises();

    expect(wrapper.text()).toContain('hello');
  });

  it('test on added item shows positive result', async () => {
    const wrapper = mount(BloomFilterViz);
    const input = wrapper.find('.bloom-input');

    await input.setValue('hello');
    await clickButton(wrapper, ['Add', '添加']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    await input.setValue('hello');
    await clickButton(wrapper, ['Test', '测试']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    const text = wrapper.text();
    expect(text).toMatch(/YES|PROBABLY|可能存在|definitely/i);
  });

  it('test on missing item shows negative result', async () => {
    const wrapper = mount(BloomFilterViz);
    const input = wrapper.find('.bloom-input');

    await input.setValue('nonexistent');
    await clickButton(wrapper, ['Test', '测试']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    const text = wrapper.text();
    expect(text).toMatch(/NO|DEFINITELY NOT|一定不存在|not in/i);
  });

  it('reset clears all bits and items', async () => {
    const wrapper = mount(BloomFilterViz);
    const input = wrapper.find('.bloom-input');

    await input.setValue('hello');
    await clickButton(wrapper, ['Add', '添加']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.text()).toContain('0%');
  });

  it('fill rate increases as items are added', async () => {
    const wrapper = mount(BloomFilterViz);
    const input = wrapper.find('.bloom-input');

    for (const item of ['apple', 'banana', 'cherry']) {
      await input.setValue(item);
      await clickButton(wrapper, ['Add', '添加']);
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    expect(wrapper.text()).not.toContain('0%');
  });
});
