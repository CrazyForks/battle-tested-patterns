import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BitmaskViz from '../../.vitepress/theme/components/BitmaskViz.vue';
import { clickButton } from '../helpers/viz-interactions';

describe('BitmaskViz', () => {
  it('renders 8 bit flag buttons', () => {
    const wrapper = mount(BitmaskViz);
    const flags = wrapper.findAll('.bm-flag');
    expect(flags).toHaveLength(8);
  });

  it('toggling a flag updates the binary display', async () => {
    const wrapper = mount(BitmaskViz);
    const firstFlag = wrapper.findAll('.bm-flag')[0];
    await firstFlag.trigger('click');

    expect(wrapper.text()).toContain('00000001');
  });

  it('toggling multiple flags produces correct mask', async () => {
    const wrapper = mount(BitmaskViz);
    const flags = wrapper.findAll('.bm-flag');

    await flags[0].trigger('click'); // bit 0 = 1
    await flags[2].trigger('click'); // bit 2 = 4

    expect(wrapper.text()).toContain('00000101');
  });

  it('toggling same flag twice returns to 0', async () => {
    const wrapper = mount(BitmaskViz);
    const flag = wrapper.findAll('.bm-flag')[0];

    await flag.trigger('click');
    await flag.trigger('click');

    expect(wrapper.text()).toContain('00000000');
  });

  it('set all button sets all bits', async () => {
    const wrapper = mount(BitmaskViz);
    await clickButton(wrapper, ['Set All', '全部设置']);

    expect(wrapper.text()).toContain('11111111');
  });

  it('displays hex value', async () => {
    const wrapper = mount(BitmaskViz);
    expect(wrapper.text()).toContain('0x00');

    const flags = wrapper.findAll('.bm-flag');
    await flags[0].trigger('click');
    expect(wrapper.text()).toContain('0x01');
  });
});
