import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CircuitBreakerViz from '../../.vitepress/theme/components/CircuitBreakerViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

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
    await clickButton(wrapper, ['Send Success', '发送成功']);

    const dots = wrapper.findAll('.cb-log-dot');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('multiple failures transition to OPEN state', async () => {
    const wrapper = mount(CircuitBreakerViz);

    for (let i = 0; i < 5; i++) {
      await clickButton(wrapper, ['Send Failure', '发送失败']);
    }

    expect(wrapper.text()).toContain('OPEN');
  });

  it('reset button returns to CLOSED', async () => {
    const wrapper = mount(CircuitBreakerViz);

    for (let i = 0; i < 5; i++) {
      await clickButton(wrapper, ['Send Failure', '发送失败']);
    }

    await clickReset(wrapper);

    expect(wrapper.text()).toContain('CLOSED');
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(CircuitBreakerViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
    const presetBtns = presets.findAll('.viz-btn');
    expect(presetBtns.length).toBeGreaterThanOrEqual(3);
  });

  it('success in CLOSED state resets failure counter', async () => {
    const wrapper = mount(CircuitBreakerViz);

    // Send 2 failures (below threshold of 3)
    await clickButton(wrapper, ['Send Failure', '发送失败']);
    await clickButton(wrapper, ['Send Failure', '发送失败']);

    // Send 1 success — should reset counter to 0
    await clickButton(wrapper, ['Send Success', '发送成功']);

    expect(wrapper.text()).toMatch(/reset.*0|重置.*0/i);

    // Now send 2 more failures — should NOT trigger OPEN (counter was reset)
    await clickButton(wrapper, ['Send Failure', '发送失败']);
    await clickButton(wrapper, ['Send Failure', '发送失败']);

    // Still CLOSED because counter was reset by the success
    expect(wrapper.text()).toContain('CLOSED');
  });

  it('a single probe success in HALF_OPEN closes the circuit (semantic alignment)', async () => {
    // Regression for the viz-vs-body semantic audit: the pattern's state
    // table says HALF_OPEN "Allow one probe call. Success → CLOSED." The
    // component must close on ONE success, not require two.
    const wrapper = mount(CircuitBreakerViz);

    // Trip to OPEN with 3 failures (threshold = 3).
    for (let i = 0; i < 3; i++) {
      await clickButton(wrapper, ['Send Failure', '发送失败']);
    }
    expect(wrapper.find('.viz-status').text()).toMatch(/→ OPEN|打开/);

    // Timeout elapses → HALF_OPEN (one probe allowed).
    await clickButton(wrapper, ['Timeout Reset', '超时重置']);
    expect(wrapper.find('.viz-status').text()).toMatch(/HALF-OPEN/);

    // A SINGLE successful probe must close the circuit immediately.
    await clickButton(wrapper, ['Send Success', '发送成功']);
    expect(wrapper.find('.viz-status').text()).toMatch(
      /HALF-OPEN → CLOSED|HALF-OPEN 中探测调用成功 → 关闭/,
    );
  });

  it('a single failure in HALF_OPEN re-trips to OPEN', async () => {
    const wrapper = mount(CircuitBreakerViz);
    for (let i = 0; i < 3; i++) {
      await clickButton(wrapper, ['Send Failure', '发送失败']);
    }
    await clickButton(wrapper, ['Timeout Reset', '超时重置']);
    expect(wrapper.find('.viz-status').text()).toMatch(/HALF-OPEN/);

    // One failed probe re-opens the circuit.
    await clickButton(wrapper, ['Send Failure', '发送失败']);
    expect(wrapper.find('.viz-status').text()).toMatch(
      /HALF-OPEN → back to OPEN|HALF-OPEN 中失败 → 重新打开/,
    );
  });
});
