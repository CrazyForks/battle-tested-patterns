import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { clickButton, clickReset } from '../helpers/viz-interactions';
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
    await clickButton(wrapper, ['+ Subscribe', '+ 订阅']);

    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(4);
  });

  it('remove subscriber decreases count', async () => {
    const wrapper = mount(ObserverViz);
    await clickButton(wrapper, ['- Unsubscribe', '- 取消订阅']);

    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(2);
  });

  it('publisher element exists', () => {
    const wrapper = mount(ObserverViz);
    const pub = wrapper.find('.obs-publisher');
    expect(pub.exists()).toBe(true);
  });

  it('reset restores initial state', async () => {
    const wrapper = mount(ObserverViz);
    await clickButton(wrapper, ['+ Subscribe', '+ 订阅']);
    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(4);

    await clickReset(wrapper);

    expect(wrapper.findAll('.obs-subscriber')).toHaveLength(3);
  });
});
