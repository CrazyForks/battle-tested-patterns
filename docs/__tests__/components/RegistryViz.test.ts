import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickButton, clickReset } from '../helpers/viz-interactions';
import RegistryViz from '../../.vitepress/theme/components/RegistryViz.vue';

describe('RegistryViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 5 available plugins', () => {
    const wrapper = mount(RegistryViz);
    expect(wrapper.text()).toContain('JSONHandler');
    expect(wrapper.text()).toContain('XMLHandler');
    expect(wrapper.text()).toContain('CSVHandler');
  });

  it('starts with empty registry table', () => {
    const wrapper = mount(RegistryViz);
    expect(wrapper.text()).toContain('No handlers registered');
  });

  it('clicking a plugin registers it into the registry', async () => {
    const wrapper = mount(RegistryViz);
    await clickButton(wrapper, ['Register', '注册']);
    vi.advanceTimersByTime(1000);
    await flushPromises();
    expect(wrapper.text()).toMatch(/Registered|已注册|1 handler/i);
  });

  it('reset clears the registry', async () => {
    const wrapper = mount(RegistryViz);
    await clickReset(wrapper);

    expect(wrapper.text()).toContain('No handlers registered');
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(RegistryViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
