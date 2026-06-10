import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DoubleBufferingViz from '../../.vitepress/theme/components/DoubleBufferingViz.vue';

describe('DoubleBufferingViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders two buffers with 12 cells each', () => {
    const wrapper = mount(DoubleBufferingViz);
    const buffers = wrapper.findAll('.db-buffer');
    expect(buffers).toHaveLength(2);
    const grids = wrapper.findAll('.db-grid');
    expect(grids).toHaveLength(2);
    expect(grids[0].findAll('.db-cell')).toHaveLength(12);
    expect(grids[1].findAll('.db-cell')).toHaveLength(12);
  });

  it('starts with frame count 0 and no filled cells', () => {
    const wrapper = mount(DoubleBufferingViz);
    const frameNum = wrapper.find('.db-frame-number');
    expect(frameNum.text()).toBe('0');
    const filled = wrapper.findAll('.db-cell--filled');
    expect(filled).toHaveLength(0);
  });

  it('draw frame fills back buffer and increments frame count', async () => {
    const wrapper = mount(DoubleBufferingViz);
    const drawBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Draw Frame') || b.text().includes('绘制帧'),
    );
    await drawBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.find('.db-frame-number').text()).toBe('1');
    const filled = wrapper.findAll('.db-cell--filled');
    expect(filled.length).toBeGreaterThanOrEqual(1);
  });

  it('swap exchanges front and back buffer contents', async () => {
    const wrapper = mount(DoubleBufferingViz);
    const drawBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Draw Frame') || b.text().includes('绘制帧'),
    );
    await drawBtn!.trigger('click');
    await flushPromises();

    const grids = wrapper.findAll('.db-grid');
    const backFilledBefore = grids[1].findAll('.db-cell--filled').length;
    expect(backFilledBefore).toBeGreaterThanOrEqual(1);

    const swapBtn = wrapper.find('.viz-btn--primary');
    await swapBtn.trigger('click');
    vi.advanceTimersByTime(500);
    await flushPromises();

    const frontFilledAfter = grids[0].findAll('.db-cell--filled').length;
    expect(frontFilledAfter).toBeGreaterThanOrEqual(1);
  });

  it('reset clears all cells and resets frame count', async () => {
    const wrapper = mount(DoubleBufferingViz);
    const drawBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Draw Frame') || b.text().includes('绘制帧'),
    );
    await drawBtn!.trigger('click');
    await flushPromises();

    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.find('.db-frame-number').text()).toBe('0');
    expect(wrapper.findAll('.db-cell--filled')).toHaveLength(0);
  });

  it('has swap arrow indicator', () => {
    const wrapper = mount(DoubleBufferingViz);
    expect(wrapper.find('.db-swap-arrow').exists()).toBe(true);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(DoubleBufferingViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
