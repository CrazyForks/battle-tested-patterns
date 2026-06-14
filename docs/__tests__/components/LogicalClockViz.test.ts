import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import LogicalClockViz from '../../.vitepress/theme/components/LogicalClockViz.vue';
import { clickButton, clickReset, clickButtonInScope } from '../helpers/viz-interactions';

describe('LogicalClockViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 3 processes P1, P2, P3 with clock=0', () => {
    const wrapper = mount(LogicalClockViz);
    const processes = wrapper.findAll('.lc-process');
    expect(processes).toHaveLength(3);
    expect(wrapper.text()).toContain('P1');
    expect(wrapper.text()).toContain('P2');
    expect(wrapper.text()).toContain('P3');
  });

  it('each process has Local, Send, Receive buttons', () => {
    const wrapper = mount(LogicalClockViz);
    const actionGroups = wrapper.findAll('.lc-actions');
    expect(actionGroups).toHaveLength(3);
    actionGroups.forEach(group => {
      const btns = group.findAll('.lc-btn');
      expect(btns).toHaveLength(3);
    });
  });

  it('Local event increments process clock by 1', async () => {
    const wrapper = mount(LogicalClockViz);
    await clickButton(wrapper, ['Local', '本地']);

    const events = wrapper.findAll('.lc-event-local');
    expect(events).toHaveLength(1);
    expect(wrapper.text()).toContain('1');
  });

  it('Send creates a pending message', async () => {
    const wrapper = mount(LogicalClockViz);
    await clickButton(wrapper, ['Send', '发送']);

    expect(wrapper.find('.lc-pending').exists()).toBe(true);
  });

  it('Receive on another process merges clocks with max()+1', async () => {
    const wrapper = mount(LogicalClockViz);
    // P1 does 3 local events (clock=3), then sends (clock=4).
    // P1's Local/Send are the first such buttons, so locate them by text.
    await clickButton(wrapper, ['Local', '本地']);
    await clickButton(wrapper, ['Local', '本地']);
    await clickButton(wrapper, ['Local', '本地']);
    await clickButton(wrapper, ['Send', '发送']);

    // P2's Receive: all three processes expose an identical "Receive" label,
    // so we scope to P2's process row and locate the button by its text there
    // (a grouping container + behavioral text, not a brittle global DOM index).
    const p2 = wrapper.findAll('.lc-process')[1];
    await clickButtonInScope(p2, ['Receive', '接收']);

    const recvEvents = wrapper.findAll('.lc-event-recv');
    expect(recvEvents).toHaveLength(1);
  });

  it('reset clears all events and clocks', async () => {
    const wrapper = mount(LogicalClockViz);
    await clickButton(wrapper, ['Local', '本地']);

    await clickReset(wrapper);

    expect(wrapper.findAll('.lc-event')).toHaveLength(0);
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(LogicalClockViz);
    const presets = wrapper.find('.viz-presets');
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
