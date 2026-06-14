import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import EventLoopViz from '../../.vitepress/theme/components/EventLoopViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

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
    await clickButton(wrapper, ['+ Sync', '+ 同步']);

    const syncItems = wrapper.findAll('.el-item--sync');
    expect(syncItems).toHaveLength(1);
  });

  it('add macro queues a macrotask', async () => {
    const wrapper = mount(EventLoopViz);
    await clickButton(wrapper, ['+ Macro', '+ 宏任务']);

    const macroItems = wrapper.findAll('.el-item--macro');
    expect(macroItems).toHaveLength(1);
  });

  it('add micro queues a microtask', async () => {
    const wrapper = mount(EventLoopViz);
    await clickButton(wrapper, ['+ Micro', '+ 微任务']);

    const microItems = wrapper.findAll('.el-item--micro');
    expect(microItems).toHaveLength(1);
  });

  it('step executes a call stack item and logs it', async () => {
    const wrapper = mount(EventLoopViz);
    await clickButton(wrapper, ['+ Sync', '+ 同步']);

    await clickButton(wrapper, ['Step', '单步']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    const syncItems = wrapper.findAll('.el-item--sync');
    expect(syncItems).toHaveLength(0);
    const logEntries = wrapper.findAll('.el-log-entry');
    expect(logEntries.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears all queues and log', async () => {
    const wrapper = mount(EventLoopViz);
    await clickButton(wrapper, ['+ Sync', '+ 同步']);

    await clickReset(wrapper);

    expect(wrapper.findAll('.el-item')).toHaveLength(0);
    expect(wrapper.findAll('.el-log-entry')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(EventLoopViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
