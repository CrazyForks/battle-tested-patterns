import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickReset } from '../helpers/viz-interactions';
import VTableViz from '../../.vitepress/theme/components/VTableViz.vue';

describe('VTableViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders object selector with Dog, Cat, Bird options', () => {
    const wrapper = mount(VTableViz);
    const select = wrapper.find('.vt-select');
    const options = select.findAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].text()).toContain('Dog');
    expect(options[1].text()).toContain('Cat');
    expect(options[2].text()).toContain('Bird');
  });

  it('renders 3 method buttons: speak(), move(), eat()', () => {
    const wrapper = mount(VTableViz);
    const methodBtns = wrapper.findAll('.vt-method-btn');
    expect(methodBtns).toHaveLength(3);
    expect(methodBtns[0].text()).toBe('speak()');
    expect(methodBtns[1].text()).toBe('move()');
    expect(methodBtns[2].text()).toBe('eat()');
  });

  it('shows vtable with entries for the selected class', () => {
    const wrapper = mount(VTableViz);
    const vtable = wrapper.find('.vt-vtable');
    const rows = vtable.findAll('.vt-vtable-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain('speak()');
    expect(rows[0].text()).toContain('Dog::speak');
  });

  it('Call Method dispatches through vtable and shows result', async () => {
    const wrapper = mount(VTableViz);
    const callBtn = wrapper.find('.vt-call-btn');
    await callBtn.trigger('click');

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    expect(wrapper.text()).toContain('Dog::speak');
    expect(wrapper.text()).toContain('"Woof!"');
  });

  it('dispatch adds entry to history', async () => {
    const wrapper = mount(VTableViz);
    const callBtn = wrapper.find('.vt-call-btn');
    await callBtn.trigger('click');

    for (let i = 0; i < 8; i++) {
      vi.advanceTimersByTime(1000);
      await flushPromises();
    }

    const history = wrapper.find('.vt-history');
    expect(history.exists()).toBe(true);
    expect(history.text()).toContain('dog1.speak()');
    expect(history.text()).toContain('Dog::speak');
  });

  it('Compare All VTables details shows all 4 class vtables', async () => {
    const wrapper = mount(VTableViz);
    const details = wrapper.find('.vt-details');
    expect(details.exists()).toBe(true);

    const compareTables = wrapper.findAll('.vt-compare-table');
    expect(compareTables).toHaveLength(4);
  });

  it('reset clears dispatch result and history', async () => {
    const wrapper = mount(VTableViz);
    const callBtn = wrapper.find('.vt-call-btn');
    await callBtn.trigger('click');
    vi.advanceTimersByTime(5000);
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.find('.vt-result').exists()).toBe(false);
    expect(wrapper.find('.vt-history').exists()).toBe(false);
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(VTableViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
