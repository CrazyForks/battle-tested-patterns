import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MiddlewareChainViz from '../../.vitepress/theme/components/MiddlewareChainViz.vue';
import { clickReset, clickButton } from '../helpers/viz-interactions';

describe('MiddlewareChainViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 5 middleware nodes in chain', () => {
    const wrapper = mount(MiddlewareChainViz);
    const nodes = wrapper.findAll('.mw-node');
    expect(nodes).toHaveLength(5);
  });

  it('renders 5 config items', () => {
    const wrapper = mount(MiddlewareChainViz);
    const items = wrapper.findAll('.mw-config-item');
    expect(items).toHaveLength(5);
  });

  it('has REQ and RES endpoints', () => {
    const wrapper = mount(MiddlewareChainViz);
    const endpoints = wrapper.findAll('.mw-endpoint');
    expect(endpoints).toHaveLength(2);
  });

  it('reset restores all middleware to enabled', async () => {
    const wrapper = mount(MiddlewareChainViz);

    // First disable a middleware (index 1 = RateLimit, not Handler which can't be disabled)
    const checkboxes = wrapper.findAll('.mw-config-item input[type="checkbox"]');
    // Toggle the second checkbox (RateLimit) to disabled
    await checkboxes[1].setValue(false);
    await flushPromises();

    // Verify it's actually disabled
    const disabled = wrapper.findAll('.mw-config-item-disabled');
    expect(disabled.length).toBeGreaterThanOrEqual(1);

    // Now reset
    await clickReset(wrapper);

    // All should be enabled again
    const disabledAfter = wrapper.findAll('.mw-config-item-disabled');
    expect(disabledAfter).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(MiddlewareChainViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });

  it('orders the chain with Logger outermost (onion model — semantic alignment)', () => {
    // Regression for the viz-vs-body semantic audit: the pattern's onion
    // diagram puts logging at the OUTERMOST layer (A=logging → B=auth →
    // C=handler), so the component's chain must start with Logger.
    const wrapper = mount(MiddlewareChainViz);
    const names = wrapper.findAll('.mw-config-name').map((n) => n.text());
    expect(names).toEqual(['Logger', 'Auth', 'RateLimit', 'Validator', 'Handler']);
  });

  it('Auth Reject preset rejects at Auth, not Logger (regression: name-based, not index)', async () => {
    // After moving Logger to index 0, a positional `middlewares[0].behavior
    // = 'reject'` would wrongly reject Logger. The preset must target Auth
    // by name. Assert via the run LOG (which records the *actual* rejecting
    // middleware's name), not the preset's hardcoded summary message.
    const wrapper = mount(MiddlewareChainViz);
    await clickButton(wrapper, ['Auth Reject', 'Auth 拒绝']);
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(300);
      await flushPromises();
    }

    const logText = wrapper
      .findAll('.viz-log-entry')
      .map((e) => e.text())
      .join('\n');
    // The log records "[#N] Auth: REJECTED" — the real rejecting middleware.
    expect(logText).toMatch(/Auth: REJECTED|Auth: 已拒绝/);
    // The bug would reject Logger (index 0). That must NOT happen.
    expect(logText).not.toMatch(/Logger: REJECTED|Logger: 已拒绝/);
  });

  it('Minimal preset keeps Logger, Auth, Handler enabled (regression: name-based disable)', async () => {
    // `presetSkipMiddleware` disables RateLimit + Validator by name. After
    // the Logger reorder, the old positional indices would have disabled the
    // wrong middleware (Auth). Verify RateLimit/Validator are the disabled ones.
    const wrapper = mount(MiddlewareChainViz);
    await clickButton(wrapper, ['Minimal', '最小管道']);
    await flushPromises();

    // Find each config item by its name and check enabled/disabled class.
    const items = wrapper.findAll('.mw-config-item');
    const byName: Record<string, boolean> = {};
    for (const item of items) {
      const name = item.find('.mw-config-name').text();
      byName[name] = !item.classes().includes('mw-config-item-disabled');
    }
    expect(byName['Logger']).toBe(true);
    expect(byName['Auth']).toBe(true);
    expect(byName['Handler']).toBe(true);
    expect(byName['RateLimit']).toBe(false);
    expect(byName['Validator']).toBe(false);
  });
});
