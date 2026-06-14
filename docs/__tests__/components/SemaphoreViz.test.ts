import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickButton, clickReset } from '../helpers/viz-interactions';
import SemaphoreViz from '../../.vitepress/theme/components/SemaphoreViz.vue';

describe('SemaphoreViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial state with 3 permit circles', () => {
    const wrapper = mount(SemaphoreViz);
    const circles = wrapper.findAll('circle[r="10"]');
    expect(circles).toHaveLength(3);
  });

  it('acquire creates an active worker', async () => {
    const wrapper = mount(SemaphoreViz);
    await clickButton(wrapper, ['Acquire', '获取']);

    const workerBoxes = wrapper.findAll('.sem-worker-box');
    expect(workerBoxes).toHaveLength(1);
  });

  it('fourth acquire goes to waiting queue', async () => {
    const wrapper = mount(SemaphoreViz);

    for (let i = 0; i < 4; i++) {
      await clickButton(wrapper, ['Acquire', '获取']);
    }

    const waiting = wrapper.findAll('.sem-waiting-box');
    expect(waiting).toHaveLength(1);
  });

  it('worker completes and releases permit after timer', async () => {
    const wrapper = mount(SemaphoreViz);
    await clickButton(wrapper, ['Acquire', '获取']);

    expect(wrapper.findAll('.sem-worker-box')).toHaveLength(1);

    vi.advanceTimersByTime(3500);
    await flushPromises();

    expect(wrapper.findAll('.sem-worker-box')).toHaveLength(0);
  });

  it('waiting worker gets promoted when permit frees', async () => {
    const wrapper = mount(SemaphoreViz);

    for (let i = 0; i < 4; i++) {
      await clickButton(wrapper, ['Acquire', '获取']);
    }

    expect(wrapper.findAll('.sem-waiting-box')).toHaveLength(1);

    // Advance enough for all workers to complete (random duration 1000-3000ms)
    for (let t = 0; t < 40; t++) {
      vi.advanceTimersByTime(100);
      await flushPromises();
    }

    expect(wrapper.findAll('.sem-waiting-box')).toHaveLength(0);
  });

  it('reset clears all workers', async () => {
    const wrapper = mount(SemaphoreViz);

    await clickButton(wrapper, ['Acquire', '获取']);
    expect(wrapper.findAll('.sem-worker-box')).toHaveLength(1);

    await clickReset(wrapper);
    expect(wrapper.findAll('.sem-worker-box')).toHaveLength(0);
  });

  it('SVG viewBox expands with waiting workers', async () => {
    const wrapper = mount(SemaphoreViz);

    for (let i = 0; i < 6; i++) {
      await clickButton(wrapper, ['Acquire', '获取']);
    }

    const svg = wrapper.find('.sem-svg');
    const viewBox = svg.attributes('viewbox') || svg.attributes('viewBox');
    const height = parseInt(viewBox!.split(' ')[3]);
    expect(height).toBeGreaterThan(204);
  });

  it('max permits select changes capacity', async () => {
    const wrapper = mount(SemaphoreViz);
    const select = wrapper.find('.sem-select');
    await select.setValue(1);
    await flushPromises();

    const circles = wrapper.findAll('circle[r="10"]');
    expect(circles).toHaveLength(1);
  });

  it('worker ID text elements use y attribute (not cy)', async () => {
    const wrapper = mount(SemaphoreViz);

    await clickButton(wrapper, ['Acquire', '获取']);

    const idTexts = wrapper.findAll('.sem-svg-id');
    for (const textEl of idTexts) {
      // SVG <text> must use y, not cy (cy is for circle/ellipse)
      expect(textEl.attributes('cy')).toBeUndefined();
      expect(textEl.attributes('y')).toBeDefined();
    }
  });
});
