import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CooperativeSchedulingViz from '../../.vitepress/theme/components/CooperativeSchedulingViz.vue';

describe('CooperativeSchedulingViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders cooperative/blocking toggle in blocking mode by default', () => {
    const wrapper = mount(CooperativeSchedulingViz);
    expect(wrapper.find('.cs-toggle').exists()).toBe(true);
    expect(wrapper.find('.cs-toggle-label').text()).toMatch(/Blocking|阻塞/);
  });

  it('renders ball animation area for UI responsiveness', () => {
    const wrapper = mount(CooperativeSchedulingViz);
    expect(wrapper.find('.cs-ball-area').exists()).toBe(true);
    expect(wrapper.find('.cs-ball').exists()).toBe(true);
  });

  it('has start task and reset buttons', () => {
    const wrapper = mount(CooperativeSchedulingViz);
    expect(wrapper.find('.viz-btn--primary').exists()).toBe(true);
    expect(wrapper.find('.viz-btn--danger').exists()).toBe(true);
  });

  it('toggle switches to cooperative mode', async () => {
    const wrapper = mount(CooperativeSchedulingViz);
    const toggle = wrapper.find('.cs-toggle');
    await toggle.trigger('click');
    await flushPromises();

    expect(wrapper.find('.cs-toggle-label').text()).toMatch(/Cooperative|协作/);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(CooperativeSchedulingViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
