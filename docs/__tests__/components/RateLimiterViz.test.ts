import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickButton, clickReset } from '../helpers/viz-interactions';
import RateLimiterViz from '../../.vitepress/theme/components/RateLimiterViz.vue';

describe('RateLimiterViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG token bucket at capacity 5 (matches the pattern Core Idea diagram)', () => {
    const wrapper = mount(RateLimiterViz);
    const svg = wrapper.find('.rl-svg');
    expect(svg.exists()).toBe(true);
    const rects = wrapper.findAll('.rl-token-active');
    // capacity=5 / rate=2/sec aligns with the pattern body's ASCII diagram.
    expect(rects.length).toBe(5);
  });

  it('send request consumes a token', async () => {
    const wrapper = mount(RateLimiterViz);
    await clickButton(wrapper, ['Send Request', '发送请求']);

    const activeTokens = wrapper.findAll('.rl-token-active');
    expect(activeTokens.length).toBe(4);
  });

  it('burst sends multiple requests', async () => {
    const wrapper = mount(RateLimiterViz);
    await clickButton(wrapper, ['Burst', '突发']);
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      await flushPromises();
    }

    const dots = wrapper.findAll('.rl-log-dot');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('requests are rejected when tokens depleted', async () => {
    const wrapper = mount(RateLimiterViz);

    for (let i = 0; i < 10; i++) {
      await clickButton(wrapper, ['Send Request', '发送请求']);
    }

    const rejectDots = wrapper.findAll('.rl-dot-reject');
    expect(rejectDots.length).toBeGreaterThanOrEqual(1);
  });

  it('reset restores full tokens', async () => {
    const wrapper = mount(RateLimiterViz);

    for (let i = 0; i < 5; i++) {
      await clickButton(wrapper, ['Send Request', '发送请求']);
    }

    await clickReset(wrapper);

    const activeTokens = wrapper.findAll('.rl-token-active');
    expect(activeTokens.length).toBe(5);
  });
});
