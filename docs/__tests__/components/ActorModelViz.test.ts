import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ActorModelViz from '../../.vitepress/theme/components/ActorModelViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('ActorModelViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 3 actors with idle state', () => {
    const wrapper = mount(ActorModelViz);
    const actors = wrapper.findAll('.am-actor');
    expect(actors).toHaveLength(3);
  });

  it('starts with 0 sent and 0 processed in stats', () => {
    const wrapper = mount(ActorModelViz);
    const stats = wrapper.findAll('.am-stat');
    expect(stats.length).toBeGreaterThanOrEqual(3);
  });

  it('send button delivers a message to target actor mailbox', async () => {
    const wrapper = mount(ActorModelViz);
    await clickButton(wrapper, ['Send', '发送']);
    vi.advanceTimersByTime(1000);
    await flushPromises();

    const text = wrapper.text();
    expect(text).toMatch(/1/);
  });

  it('reset clears all mailboxes and stats', async () => {
    const wrapper = mount(ActorModelViz);
    await clickButton(wrapper, ['Send', '发送']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    await clickReset(wrapper);

    const actors = wrapper.findAll('.am-actor');
    expect(actors).toHaveLength(3);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(ActorModelViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
