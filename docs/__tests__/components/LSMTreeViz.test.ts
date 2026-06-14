import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LSMTreeViz from '../../.vitepress/theme/components/LSMTreeViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('LSMTreeViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Memtable, Level 0, Level 1 layers', () => {
    const wrapper = mount(LSMTreeViz);
    expect(wrapper.text()).toContain('Memtable');
    expect(wrapper.text()).toContain('Level 0');
    expect(wrapper.text()).toContain('Level 1');
  });

  it('has write and read input controls', () => {
    const wrapper = mount(LSMTreeViz);
    const inputs = wrapper.findAll('.lsm-input');
    expect(inputs.length).toBeGreaterThanOrEqual(3); // key, value, search key
  });

  it('write inserts entry into memtable', async () => {
    const wrapper = mount(LSMTreeViz);
    const inputs = wrapper.findAll('.lsm-input');
    await inputs[0].setValue('a');
    await inputs[1].setValue('1');

    await clickButton(wrapper, ['Write', '写入']);
    vi.advanceTimersByTime(1000);
    await flushPromises();

    const entries = wrapper.findAll('.lsm-entry');
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('memtable shows capacity progress bar', () => {
    const wrapper = mount(LSMTreeViz);
    expect(wrapper.find('.lsm-capacity-track').exists()).toBe(true);
  });

  it('reset clears all levels', async () => {
    const wrapper = mount(LSMTreeViz);
    const inputs = wrapper.findAll('.lsm-input');
    await inputs[0].setValue('x');
    await inputs[1].setValue('1');
    await clickButton(wrapper, ['Write', '写入']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.text()).toContain('empty');
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(LSMTreeViz);
    const presets = wrapper.find('.viz-presets');
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
