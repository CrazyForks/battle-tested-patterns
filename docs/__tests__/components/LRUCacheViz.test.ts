import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LRUCacheViz from '../../.vitepress/theme/components/LRUCacheViz.vue';

describe('LRUCacheViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with capacity 4 and empty slots', () => {
    const wrapper = mount(LRUCacheViz);
    const emptyNodes = wrapper.findAll('.lru-node--empty');
    expect(emptyNodes).toHaveLength(4);
  });

  it('put adds an entry to the chain', async () => {
    const wrapper = mount(LRUCacheViz);
    const keyInput = wrapper.find('input[placeholder="Key"]');
    const valInput = wrapper.find('input[placeholder="Val"]');
    const putBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Put'),
    );

    await keyInput.setValue('A');
    await valInput.setValue('1');
    await putBtn!.trigger('click');
    await flushPromises();

    const nodes = wrapper.findAll('.lru-node:not(.lru-node--empty)');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].text()).toContain('A');
  });

  it('get on existing key shows HIT', async () => {
    const wrapper = mount(LRUCacheViz);
    const keyInput = wrapper.find('input[placeholder="Key"]');
    const valInput = wrapper.find('input[placeholder="Val"]');
    const putBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Put'),
    );
    const getBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text() === 'Get' || b.text() === '获取',
    );

    await keyInput.setValue('A');
    await valInput.setValue('1');
    await putBtn!.trigger('click');
    await flushPromises();

    await keyInput.setValue('A');
    await getBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('HIT');
  });

  it('get on missing key shows MISS', async () => {
    const wrapper = mount(LRUCacheViz);
    const keyInput = wrapper.find('input[placeholder="Key"]');
    const getBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text() === 'Get' || b.text() === '获取',
    );

    await keyInput.setValue('Z');
    await getBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('MISS');
  });

  it('evicts LRU entry when capacity exceeded', async () => {
    const wrapper = mount(LRUCacheViz);
    const keyInput = wrapper.find('input[placeholder="Key"]');
    const valInput = wrapper.find('input[placeholder="Val"]');
    const putBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Put'),
    );

    for (const key of ['A', 'B', 'C', 'D', 'E']) {
      await keyInput.setValue(key);
      await valInput.setValue(key.toLowerCase());
      await putBtn!.trigger('click');
      await flushPromises();
    }

    const nodes = wrapper.findAll('.lru-node:not(.lru-node--empty)');
    expect(nodes).toHaveLength(4);
    const allText = nodes.map((n) => n.text()).join(' ');
    expect(allText).not.toContain('A');
    expect(allText).toContain('E');
  });

  it('reset clears all entries', async () => {
    const wrapper = mount(LRUCacheViz);
    const keyInput = wrapper.find('input[placeholder="Key"]');
    const valInput = wrapper.find('input[placeholder="Val"]');
    const putBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Put'),
    );
    const resetBtn = wrapper.find('.viz-btn--danger');

    await keyInput.setValue('A');
    await valInput.setValue('1');
    await putBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.lru-node:not(.lru-node--empty)')).toHaveLength(1);

    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.lru-node:not(.lru-node--empty)')).toHaveLength(0);
  });

  it('shows MRU and LRU labels', () => {
    const wrapper = mount(LRUCacheViz);
    expect(wrapper.text()).toContain('MRU');
    expect(wrapper.text()).toContain('LRU');
  });
});
