import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CopyOnWriteViz from '../../.vitepress/theme/components/CopyOnWriteViz.vue';

describe('CopyOnWriteViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial version group', () => {
    const wrapper = mount(CopyOnWriteViz);
    const groups = wrapper.findAll('.cow-group');
    expect(groups).toHaveLength(1);
  });

  it('renders 3 readers initially', () => {
    const wrapper = mount(CopyOnWriteViz);
    const readers = wrapper.findAll('.cow-reader');
    expect(readers).toHaveLength(3);
  });

  it('renders 4 data items', () => {
    const wrapper = mount(CopyOnWriteViz);
    const items = wrapper.findAll('.cow-item');
    expect(items).toHaveLength(4);
  });

  it('has step progress indicator', () => {
    const wrapper = mount(CopyOnWriteViz);
    const steps = wrapper.findAll('.cow-step');
    expect(steps).toHaveLength(3);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(CopyOnWriteViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
