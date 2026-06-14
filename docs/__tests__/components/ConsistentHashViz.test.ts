import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ConsistentHashViz from '../../.vitepress/theme/components/ConsistentHashViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

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
    await clickButton(wrapper, ['Add Key', '添加键']);
    vi.advanceTimersByTime(600);
    await flushPromises();

    const keys = wrapper.findAll('.ch-key');
    expect(keys).toHaveLength(1);
  });

  it('add node increases node count', async () => {
    const wrapper = mount(ConsistentHashViz);
    await clickButton(wrapper, ['Add Node', '添加节点']);

    const nodes = wrapper.findAll('.ch-node');
    expect(nodes).toHaveLength(4);
  });

  it('reset restores to 3 nodes and 0 keys', async () => {
    const wrapper = mount(ConsistentHashViz);
    await clickButton(wrapper, ['Add Key', '添加键']);

    await clickReset(wrapper);

    expect(wrapper.findAll('.ch-node')).toHaveLength(3);
    expect(wrapper.findAll('.ch-key')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(ConsistentHashViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
