import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import WorkStealingViz from '../../.vitepress/theme/components/WorkStealingViz.vue';
import { clickReset } from '../helpers/viz-interactions';

describe('WorkStealingViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 3 workers', () => {
    const wrapper = mount(WorkStealingViz);
    const workers = wrapper.findAll('.ws-worker');
    expect(workers).toHaveLength(3);
  });

  it('all workers start with empty queues', () => {
    const wrapper = mount(WorkStealingViz);
    const tasks = wrapper.findAll('.ws-task');
    expect(tasks).toHaveLength(0);
    const idles = wrapper.findAll('.ws-empty');
    expect(idles).toHaveLength(3);
  });

  it('add tasks button adds tasks to a worker', async () => {
    const wrapper = mount(WorkStealingViz);
    const addBtns = wrapper.findAll('.ws-add-btn');
    await addBtns[0].trigger('click');
    await flushPromises();

    const tasks = wrapper.findAll('.ws-task');
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('reset clears all tasks', async () => {
    const wrapper = mount(WorkStealingViz);
    const addBtns = wrapper.findAll('.ws-add-btn');
    await addBtns[0].trigger('click');
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.findAll('.ws-task')).toHaveLength(0);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(WorkStealingViz);
    expect(wrapper.find('.viz-presets').exists()).toBe(true);
  });
});
