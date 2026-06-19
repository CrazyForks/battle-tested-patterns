import { describe, it, expect } from 'vitest';
import { useVizLog } from '../../.vitepress/theme/composables/useVizLog';

describe('useVizLog', () => {
  it('adds entries with incrementing index', () => {
    const { entries, log } = useVizLog();
    log('first', 'info');
    log('second', 'success');

    expect(entries.value).toHaveLength(2);
    expect(entries.value[0].index).toBe(1);
    expect(entries.value[1].index).toBe(2);
    expect(entries.value[0].type).toBe('info');
    expect(entries.value[1].type).toBe('success');
  });

  it('trims to max entries', () => {
    const { entries, log } = useVizLog(5);
    for (let i = 0; i < 8; i++) log(`entry ${i}`, 'info');

    expect(entries.value).toHaveLength(5);
    expect(entries.value[0].text).toBe('entry 3');
    expect(entries.value[4].text).toBe('entry 7');
  });

  it('clear resets entries and counter', () => {
    const { entries, log, clear } = useVizLog();
    log('test', 'info');
    log('test2', 'warning');
    clear();

    expect(entries.value).toHaveLength(0);
    log('after clear', 'info');
    expect(entries.value[0].index).toBe(1);
  });

  it('supports all entry types', () => {
    const { entries, log } = useVizLog();
    const types = ['info', 'success', 'warning', 'error', 'highlight'] as const;
    types.forEach((t) => log(`msg-${t}`, t));

    expect(entries.value).toHaveLength(5);
    types.forEach((t, i) => {
      expect(entries.value[i].type).toBe(t);
    });
  });

  it('default max is 60', () => {
    const { entries, log } = useVizLog();
    for (let i = 0; i < 65; i++) log(`entry ${i}`, 'info');
    expect(entries.value).toHaveLength(60);
  });
});
