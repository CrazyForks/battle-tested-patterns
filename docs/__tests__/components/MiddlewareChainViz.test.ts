import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MiddlewareChainViz from '../../.vitepress/theme/components/MiddlewareChainViz.vue';
import { clickReset } from '../helpers/viz-interactions';

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
});
