import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RetryBackoffViz from '../../.vitepress/theme/components/RetryBackoffViz.vue';

describe('RetryBackoffViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with start button', () => {
    const wrapper = mount(RetryBackoffViz);
    const startBtn = wrapper.find('.viz-btn--primary');
    expect(startBtn.exists()).toBe(true);
  });

  it('start button initiates retry sequence', async () => {
    const wrapper = mount(RetryBackoffViz);
    const startBtn = wrapper.find('.viz-btn--primary');
    await startBtn.trigger('click');

    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(200);
      await flushPromises();
    }

    const attempts = wrapper.findAll('.rb-attempt');
    expect(attempts.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears attempts', async () => {
    const wrapper = mount(RetryBackoffViz);
    const startBtn = wrapper.find('.viz-btn--primary');
    await startBtn.trigger('click');

    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(200);
      await flushPromises();
    }

    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    const attempts = wrapper.findAll('.rb-attempt');
    expect(attempts).toHaveLength(0);
  });

  it('has failure rate slider', () => {
    const wrapper = mount(RetryBackoffViz);
    const slider = wrapper.find('input[type="range"]');
    expect(slider.exists()).toBe(true);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(RetryBackoffViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
