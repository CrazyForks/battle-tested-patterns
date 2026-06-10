import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MiddlewareChainViz from '../../.vitepress/theme/components/MiddlewareChainViz.vue';

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
    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    const disabled = wrapper.findAll('.mw-config-item-disabled');
    expect(disabled).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(MiddlewareChainViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
