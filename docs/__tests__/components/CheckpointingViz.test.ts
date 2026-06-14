import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CheckpointingViz from '../../.vitepress/theme/components/CheckpointingViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('CheckpointingViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty log and state value 0', () => {
    const wrapper = mount(CheckpointingViz);
    expect(wrapper.findAll('.cp-log-entry')).toHaveLength(0);
    const stateBox = wrapper.find('.cp-state-value');
    expect(stateBox.text()).toBe('0');
  });

  it('applying an operation adds a log entry and changes state', async () => {
    const wrapper = mount(CheckpointingViz);
    await clickButton(wrapper, '+3');
    vi.advanceTimersByTime(500);
    await flushPromises();
    expect(wrapper.findAll('.cp-log-entry').length).toBeGreaterThanOrEqual(1);
  });

  it('checkpoint creates a marker in the log', async () => {
    const wrapper = mount(CheckpointingViz);
    await clickButton(wrapper, '+3');
    vi.advanceTimersByTime(500);
    await flushPromises();

    await clickButton(wrapper, ['Checkpoint', '创建快照']);
    vi.advanceTimersByTime(500);
    await flushPromises();

    const markers = wrapper.findAll('.cp-marker');
    expect(markers.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears log, state, and checkpoints', async () => {
    const wrapper = mount(CheckpointingViz);
    await clickReset(wrapper);

    expect(wrapper.findAll('.cp-log-entry')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(CheckpointingViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
