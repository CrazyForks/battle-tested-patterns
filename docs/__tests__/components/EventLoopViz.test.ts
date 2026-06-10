import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import EventLoopViz from '../../.vitepress/theme/components/EventLoopViz.vue';

describe('EventLoopViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders three columns (Call Stack, Microtask, Macrotask)', () => {
    const wrapper = mount(EventLoopViz);
    const columns = wrapper.findAll('.el-column');
    expect(columns).toHaveLength(3);
  });

  it('starts with idle phase and empty queues', () => {
    const wrapper = mount(EventLoopViz);
    const phase = wrapper.find('.el-phase');
    expect(phase.text()).toContain('IDLE');
    const items = wrapper.findAll('.el-item');
    expect(items).toHaveLength(0);
  });

  it('add sync pushes item to call stack', async () => {
    const wrapper = mount(EventLoopViz);
    const syncBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Sync'),
    );
    await syncBtn!.trigger('click');
    await flushPromises();

    const syncItems = wrapper.findAll('.el-item--sync');
    expect(syncItems).toHaveLength(1);
  });

  it('add macro queues a macrotask', async () => {
    const wrapper = mount(EventLoopViz);
    const macroBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Macro') && !b.text().includes('Micro'),
    );
    await macroBtn!.trigger('click');
    await flushPromises();

    const macroItems = wrapper.findAll('.el-item--macro');
    expect(macroItems).toHaveLength(1);
  });

  it('add micro queues a microtask', async () => {
    const wrapper = mount(EventLoopViz);
    const microBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Micro'),
    );
    await microBtn!.trigger('click');
    await flushPromises();

    const microItems = wrapper.findAll('.el-item--micro');
    expect(microItems).toHaveLength(1);
  });

  it('step executes a call stack item and logs it', async () => {
    const wrapper = mount(EventLoopViz);
    const syncBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Sync'),
    );
    await syncBtn!.trigger('click');
    await flushPromises();

    const stepBtn = wrapper.find('.viz-btn--primary');
    await stepBtn.trigger('click');
    vi.advanceTimersByTime(500);
    await flushPromises();

    const syncItems = wrapper.findAll('.el-item--sync');
    expect(syncItems).toHaveLength(0);
    const logEntries = wrapper.findAll('.el-log-entry');
    expect(logEntries.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears all queues and log', async () => {
    const wrapper = mount(EventLoopViz);
    const syncBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('Sync'),
    );
    await syncBtn!.trigger('click');
    await flushPromises();

    const resetBtn = wrapper.find('.viz-btn--danger');
    await resetBtn.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.el-item')).toHaveLength(0);
    expect(wrapper.findAll('.el-log-entry')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(EventLoopViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
