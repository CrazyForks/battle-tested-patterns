import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import TombstoneViz from '../../.vitepress/theme/components/TombstoneViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('TombstoneViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 12 grid cells with 4 active and 8 free initially', () => {
    const wrapper = mount(TombstoneViz);
    const cells = wrapper.findAll('.ts-cell');
    expect(cells).toHaveLength(12);

    const activeCells = wrapper.findAll('.ts-cell--active');
    expect(activeCells).toHaveLength(4);

    const freeCells = wrapper.findAll('.ts-cell--free');
    expect(freeCells).toHaveLength(8);
  });

  it('shows initial entries: user:1=Alice, user:2=Bob, user:3=Carol, cfg:theme=dark', () => {
    const wrapper = mount(TombstoneViz);
    expect(wrapper.text()).toContain('user:1');
    expect(wrapper.text()).toContain('Alice');
    expect(wrapper.text()).toContain('user:2');
    expect(wrapper.text()).toContain('Bob');
    expect(wrapper.text()).toContain('cfg:theme');
    expect(wrapper.text()).toContain('dark');
  });

  it('displays usage stats: Active 4, Tombstoned 0, Free 8', () => {
    const wrapper = mount(TombstoneViz);
    const stats = wrapper.find('.ts-usage-stats');
    expect(stats.text()).toContain('4');
    expect(stats.text()).toContain('0');
    expect(stats.text()).toContain('8');
  });

  it('delete button tombstones an active entry', async () => {
    const wrapper = mount(TombstoneViz);
    const deleteBtn = wrapper.find('.ts-delete-btn');
    await deleteBtn.trigger('click');
    vi.advanceTimersByTime(1000);
    await flushPromises();

    const tombstoned = wrapper.findAll('.ts-cell--tombstoned');
    expect(tombstoned).toHaveLength(1);
  });

  it('write button adds a new entry to a free slot', async () => {
    const wrapper = mount(TombstoneViz);
    await clickButton(wrapper, ['Write', '写入']);
    vi.advanceTimersByTime(1000);
    await flushPromises();

    const activeCells = wrapper.findAll('.ts-cell--active');
    expect(activeCells).toHaveLength(5);
  });

  it('compact button is disabled when no tombstoned entries exist', () => {
    const wrapper = mount(TombstoneViz);
    // Located by visible text (not style class); we need the element itself to
    // assert the `disabled` attribute, so we can't use clickButton here.
    const compactBtn = wrapper.findAll('button').find(
      b => b.text().includes('Compact') || b.text().includes('压缩')
    );
    expect(compactBtn!.attributes('disabled')).toBeDefined();
  });

  it('reset restores initial 4 entries and 8 free slots', async () => {
    const wrapper = mount(TombstoneViz);

    const deleteBtn = wrapper.find('.ts-delete-btn');
    await deleteBtn.trigger('click');
    vi.advanceTimersByTime(1000);
    await flushPromises();

    await clickReset(wrapper);

    expect(wrapper.findAll('.ts-cell--active')).toHaveLength(4);
    expect(wrapper.findAll('.ts-cell--free')).toHaveLength(8);
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(TombstoneViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
