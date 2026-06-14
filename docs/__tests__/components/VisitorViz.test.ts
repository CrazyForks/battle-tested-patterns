import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { clickButton, clickReset } from '../helpers/viz-interactions';
import VisitorViz from '../../.vitepress/theme/components/VisitorViz.vue';

describe('VisitorViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders AST tree with 10 SVG nodes (1 Prog, 2 Func, 3 Stmt, 4 Expr)', () => {
    const wrapper = mount(VisitorViz);
    expect(wrapper.find('svg').exists()).toBe(true);

    const nodeTexts = wrapper.findAll('svg text').map(t => t.text());
    expect(nodeTexts.filter(t => t === 'Prog')).toHaveLength(1);
    expect(nodeTexts.filter(t => t === 'Func')).toHaveLength(2);
    expect(nodeTexts.filter(t => t === 'Stmt')).toHaveLength(3);
    expect(nodeTexts.filter(t => t === 'Expr')).toHaveLength(4);
  });

  it('has Print Visitor and Count Visitor type buttons', () => {
    const wrapper = mount(VisitorViz);
    const typeBtns = wrapper.findAll('.vv-type-btn');
    expect(typeBtns).toHaveLength(2);
    expect(typeBtns[0].text()).toBe('Print Visitor');
    expect(typeBtns[1].text()).toBe('Count Visitor');
  });

  it('clicking Visit with Print Visitor shows visit output for all nodes', async () => {
    const wrapper = mount(VisitorViz);
    await clickButton(wrapper, ['Visit', '访问']);

    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    const outputLines = wrapper.findAll('.vv-output-line');
    expect(outputLines.length).toBe(10);
    expect(outputLines[0].text()).toContain('visit(Program)');
  });

  it('Count Visitor shows incrementing count for each node', async () => {
    const wrapper = mount(VisitorViz);

    await clickButton(wrapper, 'Count Visitor');

    await clickButton(wrapper, ['Visit', '访问']);

    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    const outputLines = wrapper.findAll('.vv-output-line');
    expect(outputLines.length).toBe(10);
    expect(outputLines[0].text()).toContain('count = 1');
  });

  it('reset clears visitor output and restores tree', async () => {
    const wrapper = mount(VisitorViz);
    await clickButton(wrapper, ['Visit', '访问']);

    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(500);
      await flushPromises();
    }

    await clickReset(wrapper);

    expect(wrapper.find('.vv-output').exists()).toBe(false);
  });

  it('has 3 preset scenario buttons', () => {
    const wrapper = mount(VisitorViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
    const btns = presets.findAll('.viz-btn');
    expect(btns).toHaveLength(3);
  });
});
