import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ObserverViz from '../../.vitepress/theme/components/ObserverViz.vue';

describe('ObserverViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with initial subscribers', () => {
    const wrapper = mount(ObserverViz);
    const subs = wrapper.findAll('.obs-subscriber');
    expect(subs).toHaveLength(3);
  });

  it('add subscriber increases count', async () => {
    const wrapper = mount(ObserverViz);
    const addBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Subscribe') || b.text().includes('订阅'),
    );
    await addBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(4);
  });

  it('remove subscriber decreases count', async () => {
    const wrapper = mount(ObserverViz);
    const removeBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Unsubscribe') || b.text().includes('取消订阅'),
    );
    await removeBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(2);
  });

  it('publisher element exists', () => {
    const wrapper = mount(ObserverViz);
    const pub = wrapper.find('.obs-publisher');
    expect(pub.exists()).toBe(true);
  });

  it('reset restores initial state', async () => {
    const wrapper = mount(ObserverViz);
    const addBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Subscribe') || b.text().includes('订阅'),
    );
    await addBtn!.trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(4);

    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(3);
  });
});
