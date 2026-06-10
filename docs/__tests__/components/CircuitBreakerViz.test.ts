import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CircuitBreakerViz from '../../.vitepress/theme/components/CircuitBreakerViz.vue';

describe('CircuitBreakerViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders in CLOSED state initially', () => {
    const wrapper = mount(CircuitBreakerViz);
    expect(wrapper.text()).toContain('CLOSED');
  });

  it('renders SVG state diagram', () => {
    const wrapper = mount(CircuitBreakerViz);
    const svg = wrapper.find('.cb-svg');
    expect(svg.exists()).toBe(true);
  });

  it('send success button adds to request log', async () => {
    const wrapper = mount(CircuitBreakerViz);
    const successBtn = wrapper.find('.viz-btn--primary');
    await successBtn.trigger('click');
    await flushPromises();

    const dots = wrapper.findAll('.cb-log-dot');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('multiple failures transition to OPEN state', async () => {
    const wrapper = mount(CircuitBreakerViz);
    const failBtn = wrapper.findAll('.viz-btn--danger').find((b) =>
      b.text().includes('Failure') || b.text().includes('失败'),
    );

    for (let i = 0; i < 5; i++) {
      await failBtn!.trigger('click');
      await flushPromises();
    }

    expect(wrapper.text()).toContain('OPEN');
  });

  it('reset button returns to CLOSED', async () => {
    const wrapper = mount(CircuitBreakerViz);
    const failBtn = wrapper.findAll('.viz-btn--danger').find((b) =>
      b.text().includes('Failure') || b.text().includes('失败'),
    );
    const resetBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Reset All') || b.text().includes('全部重置'),
    );

    for (let i = 0; i < 5; i++) {
      await failBtn!.trigger('click');
      await flushPromises();
    }

    await resetBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('CLOSED');
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(CircuitBreakerViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
    const presetBtns = presets.findAll('.viz-btn');
    expect(presetBtns.length).toBeGreaterThanOrEqual(3);
  });
});
