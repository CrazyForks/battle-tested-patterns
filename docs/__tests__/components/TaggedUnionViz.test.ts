import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TaggedUnionViz from '../../.vitepress/theme/components/TaggedUnionViz.vue';
import { clickButton, clickReset } from '../helpers/viz-interactions';

describe('TaggedUnionViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 4 type buttons: Number, String, Bool, None', () => {
    const wrapper = mount(TaggedUnionViz);
    const btns = wrapper.findAll('.tu-type-btn');
    expect(btns).toHaveLength(4);
    expect(btns[0].text()).toContain('Number');
    expect(btns[1].text()).toContain('String');
    expect(btns[2].text()).toContain('Bool');
    expect(btns[3].text()).toContain('None');
  });

  it('starts with Number tag active and displays 42', () => {
    const wrapper = mount(TaggedUnionViz);
    const badge = wrapper.find('.tu-tag-badge');
    expect(badge.text()).toBe('Number');
    expect(wrapper.find('.tu-var-value').text()).toBe('42');
  });

  it('shows 9 memory cells (1 tag byte + 8 value bytes)', () => {
    const wrapper = mount(TaggedUnionViz);
    const cells = wrapper.findAll('.tu-mem-cell');
    expect(cells).toHaveLength(9);
    expect(cells[0].classes()).toContain('tu-mem-cell--tag');
    expect(cells[0].text()).toContain('0x01');
  });

  it('clicking String button changes tag, value, and memory layout', async () => {
    const wrapper = mount(TaggedUnionViz);

    // Type buttons render their tag name as text (e.g. `String("hello")`),
    // so locate by the tag label rather than DOM index.
    await clickButton(wrapper, 'String');

    expect(wrapper.find('.tu-tag-badge').text()).toBe('String');
    expect(wrapper.find('.tu-var-value').text()).toBe('"hello"');
    const tagCell = wrapper.findAll('.tu-mem-cell')[0];
    expect(tagCell.text()).toContain('0x02');
  });

  it('Run match highlights the correct branch and shows output', async () => {
    const wrapper = mount(TaggedUnionViz);

    await clickButton(wrapper, ['Run match', '运行 match']);

    const activeArm = wrapper.find('.tu-match-arm--active');
    expect(activeArm.exists()).toBe(true);
    expect(activeArm.text()).toContain('Number');

    const result = wrapper.find('.tu-match-result');
    expect(result.exists()).toBe(true);
    expect(result.text()).toContain('"got number: 42"');
  });

  it('switching type then running match dispatches to the new branch', async () => {
    const wrapper = mount(TaggedUnionViz);

    await clickButton(wrapper, 'Bool');

    await clickButton(wrapper, ['Run match', '运行 match']);

    const activeArm = wrapper.find('.tu-match-arm--active');
    expect(activeArm.text()).toContain('Bool');
    expect(wrapper.find('.tu-match-result').text()).toContain('"got bool: true"');
  });

  it('reset restores Number tag and clears match result', async () => {
    const wrapper = mount(TaggedUnionViz);

    await clickButton(wrapper, 'String');
    await clickButton(wrapper, ['Run match', '运行 match']);

    await clickReset(wrapper);

    expect(wrapper.find('.tu-tag-badge').text()).toBe('Number');
    expect(wrapper.find('.tu-match-result').exists()).toBe(false);
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(TaggedUnionViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
