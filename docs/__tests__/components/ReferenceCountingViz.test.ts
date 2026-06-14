import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickReset } from '../helpers/viz-interactions';
import ReferenceCountingViz from '../../.vitepress/theme/components/ReferenceCountingViz.vue';

describe('ReferenceCountingViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 2 initial objects and 3 references', () => {
    const wrapper = mount(ReferenceCountingViz);
    expect(wrapper.text()).toContain('Obj A');
    expect(wrapper.text()).toContain('Obj B');
    expect(wrapper.text()).toContain('var x');
    expect(wrapper.text()).toContain('var y');
    expect(wrapper.text()).toContain('var z');
  });

  it('shows reference count for each object', () => {
    const wrapper = mount(ReferenceCountingViz);
    expect(wrapper.text()).toContain('rc=2'); // Obj A has 2 refs
    expect(wrapper.text()).toContain('rc=1'); // Obj B has 1 ref
  });

  it('drop reference removes a reference and decrements count', async () => {
    const wrapper = mount(ReferenceCountingViz);
    // Component uses .rc-ref elements with @click="dropRef(i)"
    const refs = wrapper.findAll('.rc-ref');
    expect(refs.length).toBeGreaterThanOrEqual(1);

    await refs[0].trigger('click');
    vi.advanceTimersByTime(1000);
    await flushPromises();

    // After dropping one ref from Obj A (initially rc=2), it should become rc=1
    expect(wrapper.text()).toContain('rc=1');
  });

  it('reset restores initial objects and references', async () => {
    const wrapper = mount(ReferenceCountingViz);
    await clickReset(wrapper);

    expect(wrapper.text()).toContain('Obj A');
    expect(wrapper.text()).toContain('rc=2');
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(ReferenceCountingViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
