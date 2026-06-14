import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickButton, clickReset, hasButton } from '../helpers/viz-interactions';
import RingBufferViz from '../../.vitepress/theme/components/RingBufferViz.vue';

describe('RingBufferViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 8 buffer cells as SVG circles', () => {
    const wrapper = mount(RingBufferViz);
    const circles = wrapper.findAll('.ringbuf-svg circle[r="22"]');
    expect(circles).toHaveLength(8);
  });

  it('shows count as 0/8 initially', () => {
    const wrapper = mount(RingBufferViz);
    const svg = wrapper.find('.ringbuf-svg');
    expect(svg.text()).toContain('0');
    expect(svg.text()).toContain('/8');
  });

  it('shows tail pointer label initially', () => {
    const wrapper = mount(RingBufferViz);
    const svg = wrapper.find('.ringbuf-svg');
    expect(svg.text()).toContain('T');
  });

  it('enqueue button exists and is clickable', async () => {
    const wrapper = mount(RingBufferViz);
    expect(hasButton(wrapper, ['Enqueue', '入队'])).toBe(true);

    await clickButton(wrapper, ['Enqueue', '入队']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    const svg = wrapper.find('.ringbuf-svg');
    expect(svg.text()).toContain('1');
  });

  it('reset button clears buffer', async () => {
    const wrapper = mount(RingBufferViz);

    await clickButton(wrapper, ['Enqueue', '入队']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    await clickReset(wrapper);

    const svg = wrapper.find('.ringbuf-svg');
    expect(svg.text()).toContain('0');
  });
});
