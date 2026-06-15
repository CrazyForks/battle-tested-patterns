import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import WriteAheadLogViz from '../../.vitepress/theme/components/WriteAheadLogViz.vue';
import { clickButton } from '../helpers/viz-interactions';

describe('WriteAheadLogViz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders WAL and Table sections', () => {
    const wrapper = mount(WriteAheadLogViz);
    const sections = wrapper.findAll('.wal-section');
    expect(sections).toHaveLength(2);
  });

  it('starts with empty WAL', () => {
    const wrapper = mount(WriteAheadLogViz);
    const entries = wrapper.findAll('.wal-entry');
    expect(entries).toHaveLength(0);
  });

  it('write button adds a WAL entry', async () => {
    const wrapper = mount(WriteAheadLogViz);
    await clickButton(wrapper, ['Write', '写入']);

    const entries = wrapper.findAll('.wal-entry');
    expect(entries).toHaveLength(1);
  });

  it('flush moves data to table', async () => {
    const wrapper = mount(WriteAheadLogViz);
    await clickButton(wrapper, ['Write', '写入']);

    await clickButton(wrapper, ['Flush to Table', '刷写到表']);

    const rows = wrapper.findAll('.wal-row');
    expect(rows).toHaveLength(1);
  });

  it('has preset scenario buttons', () => {
    const wrapper = mount(WriteAheadLogViz);
    const presets = wrapper.find('.viz-presets');
    expect(presets.exists()).toBe(true);
  });
});
