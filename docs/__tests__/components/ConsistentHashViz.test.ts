import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ConsistentHashViz from '../../.vitepress/theme/components/ConsistentHashViz.vue';

describe('ConsistentHashViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SVG hash ring with 3 initial nodes', () => {
    const wrapper = mount(ConsistentHashViz);
    expect(wrapper.find('.ch-svg').exists()).toBe(true);
    const nodes = wrapper.findAll('.ch-node');
    expect(nodes).toHaveLength(3);
  });

  it('add key places a key on the ring', async () => {
    const wrapper = mount(ConsistentHashViz);
    const addKeyBtn = wrapper.find('.viz-btn--primary');
    await addKeyBtn.trigger('click');
    vi.advanceTimersByTime(600);
    await flushPromises();

    const keys = wrapper.findAll('.ch-key');
    expect(keys).toHaveLength(1);
  });

  it('add node increases node count', async () => {
    const wrapper = mount(ConsistentHashViz);
    const addNodeBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Add Node') || b.text().includes('添加节点'),
    );
    await addNodeBtn!.trigger('click');
    await flushPromises();

    const nodes = wrapper.findAll('.ch-node');
    expect(nodes).toHaveLength(4);
  });

  it('reset restores to 3 nodes and 0 keys', async () => {
    const wrapper = mount(ConsistentHashViz);
    const addKeyBtn = wrapper.find('.viz-btn--primary');
    await addKeyBtn.trigger('click');
    await flushPromises();

    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.ch-node')).toHaveLength(3);
    expect(wrapper.findAll('.ch-key')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(ConsistentHashViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
