import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RetryBackoffViz from '../../.vitepress/theme/components/RetryBackoffViz.vue';
import { clickButton, clickReset, hasButton } from '../helpers/viz-interactions';

describe('RetryBackoffViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with start button', () => {
    const wrapper = mount(RetryBackoffViz);
    expect(hasButton(wrapper, ['Send Request', '发送请求'])).toBe(true);
  });

  it('start button initiates retry sequence', async () => {
    const wrapper = mount(RetryBackoffViz);
    await clickButton(wrapper, ['Send Request', '发送请求']);

    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(200);
      await flushPromises();
    }

    const attempts = wrapper.findAll('.rb-attempt');
    expect(attempts.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears attempts', async () => {
    const wrapper = mount(RetryBackoffViz);
    await clickButton(wrapper, ['Send Request', '发送请求']);

    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(200);
      await flushPromises();
    }

    await clickReset(wrapper);

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

  it('empty state SVG viewBox is wide enough for text (>=280)', () => {
    const wrapper = mount(RetryBackoffViz);
    const emptySvg = wrapper.find('.rb-empty-svg');
    expect(emptySvg.exists()).toBe(true);
    const viewBox = emptySvg.attributes('viewBox') || emptySvg.attributes('viewbox') || '';
    const width = parseInt(viewBox.split(' ')[2] || '0', 10);
    // Must be at least 280 to fit English placeholder text
    expect(width).toBeGreaterThanOrEqual(280);
  });

  it('formula bar uses additive jitter, not ± (semantic alignment)', () => {
    // Regression for the viz-vs-body semantic audit: the pattern formula is
    // additive — delay = min(base*2^attempt + random(0, jitter), cap).
    // The bar must NOT show the old two-directional '± random jitter'.
    const wrapper = mount(RetryBackoffViz);
    const formula = wrapper.find('.rb-formula').text();
    expect(formula).toContain('random(0, jitter)');
    expect(formula).not.toContain('±');
  });
});
