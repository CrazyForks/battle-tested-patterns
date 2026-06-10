import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import StateMachineViz from '../../.vitepress/theme/components/StateMachineViz.vue';

describe('StateMachineViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders in IDLE state initially', () => {
    const wrapper = mount(StateMachineViz);
    const svg = wrapper.find('.sm-svg');
    expect(svg.exists()).toBe(true);
    const activeNode = wrapper.find('.sm-node-active');
    expect(activeNode.exists()).toBe(true);
  });

  it('renders all event buttons', () => {
    const wrapper = mount(StateMachineViz);
    const btns = wrapper.findAll('.viz-btn');
    const eventNames = ['FETCH', 'RESOLVE', 'REJECT', 'RETRY', 'RESET'];
    for (const name of eventNames) {
      const found = btns.some((b) => b.text().includes(name));
      expect(found).toBe(true);
    }
  });

  it('FETCH transitions from IDLE to LOADING', async () => {
    const wrapper = mount(StateMachineViz);
    const fetchBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('FETCH'),
    );

    await fetchBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('LOADING');
  });

  it('invalid event shows error message', async () => {
    const wrapper = mount(StateMachineViz);
    const resolveBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('RESOLVE'),
    );

    await resolveBtn!.trigger('click');
    await flushPromises();

    const text = wrapper.text().toLowerCase();
    expect(text).toMatch(/cannot|invalid|impossible|无法/i);
  });

  it('full happy path: IDLE → LOADING → SUCCESS', async () => {
    const wrapper = mount(StateMachineViz);
    const btns = wrapper.findAll('.viz-btn');
    const fetchBtn = btns.find((b) => b.text().includes('FETCH'));
    const resolveBtn = btns.find((b) => b.text().includes('RESOLVE'));

    await fetchBtn!.trigger('click');
    await flushPromises();

    await resolveBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('SUCCESS');
  });

  it('reset returns to IDLE', async () => {
    const wrapper = mount(StateMachineViz);
    const btns = wrapper.findAll('.viz-btn');
    const fetchBtn = btns.find((b) => b.text().includes('FETCH'));
    const resetBtn = wrapper.find('.viz-btn--danger');

    await fetchBtn!.trigger('click');
    await flushPromises();

    await resetBtn.trigger('click');
    await flushPromises();

    const historyItems = wrapper.findAll('.sm-history-item');
    expect(historyItems).toHaveLength(0);
  });

  it('tracks transition history', async () => {
    const wrapper = mount(StateMachineViz);
    const fetchBtn = wrapper.findAll('.viz-btn').find((b) =>
      b.text().includes('FETCH'),
    );

    await fetchBtn!.trigger('click');
    await flushPromises();

    const historyItems = wrapper.findAll('.sm-history-item');
    expect(historyItems.length).toBeGreaterThanOrEqual(1);
  });
});
