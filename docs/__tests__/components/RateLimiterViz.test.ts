import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RateLimiterViz from '../../.vitepress/theme/components/RateLimiterViz.vue';

describe('RateLimiterViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG token bucket', () => {
    const wrapper = mount(RateLimiterViz);
    const svg = wrapper.find('.rl-svg');
    expect(svg.exists()).toBe(true);
    const rects = wrapper.findAll('.rl-token-active');
    expect(rects.length).toBe(8);
  });

  it('send request consumes a token', async () => {
    const wrapper = mount(RateLimiterViz);
    const sendBtn = wrapper.find('.viz-btn--primary');
    await sendBtn.trigger('click');
    await flushPromises();

    const activeTokens = wrapper.findAll('.rl-token-active');
    expect(activeTokens.length).toBe(7);
  });

  it('burst sends multiple requests', async () => {
    const wrapper = mount(RateLimiterViz);
    const burstBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Burst') || b.text().includes('突发'),
    );

    await burstBtn!.trigger('click');
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
      await flushPromises();
    }

    const dots = wrapper.findAll('.rl-log-dot');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('requests are rejected when tokens depleted', async () => {
    const wrapper = mount(RateLimiterViz);
    const sendBtn = wrapper.find('.viz-btn--primary');

    for (let i = 0; i < 10; i++) {
      await sendBtn.trigger('click');
      await flushPromises();
    }

    const rejectDots = wrapper.findAll('.rl-dot-reject');
    expect(rejectDots.length).toBeGreaterThanOrEqual(1);
  });

  it('reset restores full tokens', async () => {
    const wrapper = mount(RateLimiterViz);
    const sendBtn = wrapper.find('.viz-btn--primary');

    for (let i = 0; i < 5; i++) {
      await sendBtn.trigger('click');
      await flushPromises();
    }

    const resetBtn = wrapper.findAll('.viz-btn--danger').find((b) =>
      b.text().includes('Reset') || b.text().includes('重置'),
    );
    await resetBtn!.trigger('click');
    await flushPromises();

    const activeTokens = wrapper.findAll('.rl-token-active');
    expect(activeTokens.length).toBe(8);
  });
});
