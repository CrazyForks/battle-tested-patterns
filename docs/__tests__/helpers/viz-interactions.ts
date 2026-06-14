/**
 * Shared interaction helpers for Viz component tests.
 *
 * Why this exists:
 * Tests historically located controls by *style* classes (`.viz-btn--primary`,
 * `.viz-btn--danger`) or by DOM index (`findAll('.viz-btn')[1]`). Those are
 * implementation details — they break when buttons are reordered or restyled,
 * and worse, an index that silently shifts can make a test pass while exercising
 * the wrong control (false green).
 *
 * These helpers locate controls the way a user does — by their visible label or
 * accessible name — and skip disabled controls. They keep tests aligned with the
 * 3A pattern: the Act step reads as the user's intent, not as DOM trivia.
 *
 * Selector priority (most → least stable):
 *   1. Accessible name (aria-label)  — used by VizPlaybackBar
 *   2. Visible button text (i18n EN/ZH) — used by every *Viz action button
 *   3. (avoided) style class / DOM index
 */
import { flushPromises, type VueWrapper, type DOMWrapper } from '@vue/test-utils';
import { vi } from 'vitest';

type AnyWrapper = VueWrapper<any>;
type Btn = DOMWrapper<HTMLButtonElement>;

/** A label can be a single string or an EN/ZH pair (tests run in EN by default). */
export type Label = string | string[];

function labels(label: Label): string[] {
  return Array.isArray(label) ? label : [label];
}

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true;
}

/**
 * Find an enabled <button> whose visible text matches `label`.
 * Exact match wins over a contains-match so "Reset" never grabs "Timeout Reset".
 * Returns null if none found.
 */
export function findButtonByText(wrapper: AnyWrapper, label: Label): Btn | null {
  const wanted = labels(label).map((s) => s.trim());
  const buttons = (wrapper.findAll('button') as Btn[]).filter(
    (b) => !isDisabled(b.element),
  );
  // Exact match pass.
  for (const w of wanted) {
    const exact = buttons.find((b) => b.text().trim() === w);
    if (exact) return exact;
  }
  // Contains pass.
  for (const w of wanted) {
    const partial = buttons.find((b) => b.text().trim().includes(w));
    if (partial) return partial;
  }
  return null;
}

/** Find an enabled element by its accessible name (aria-label). Returns null if none. */
export function findByAriaLabel(
  wrapper: AnyWrapper,
  label: Label,
): DOMWrapper<Element> | null {
  for (const w of labels(label)) {
    const el = wrapper.find(`[aria-label="${w}"]`);
    if (el.exists() && !isDisabled(el.element)) return el;
  }
  return null;
}

/**
 * Click a button located by its visible label. Throws a descriptive error if
 * the button is missing — surfacing test/markup drift loudly instead of silently
 * clicking the wrong element.
 */
export async function clickButton(wrapper: AnyWrapper, label: Label): Promise<void> {
  const btn = findButtonByText(wrapper, label);
  if (!btn) {
    const available = wrapper
      .findAll('button')
      .map((b) => `"${b.text().trim()}"`)
      .join(', ');
    throw new Error(
      `clickButton: no enabled button matching ${JSON.stringify(label)}. ` +
        `Available buttons: [${available}]`,
    );
  }
  await btn.trigger('click');
  await flushPromises();
}

/** True if a button with the given label exists and is enabled. */
export function hasButton(wrapper: AnyWrapper, label: Label): boolean {
  return findButtonByText(wrapper, label) !== null;
}

/**
 * Find an enabled <button> by visible text *within a scope element* (e.g. one
 * row/group). Use this when several identical labels exist across repeated UI
 * groups (e.g. each process row exposes its own "Receive" button), so a plain
 * text lookup is ambiguous. The scope is located by the caller (typically a
 * group wrapper from `findAll(...)`), keeping the test's intent explicit while
 * still avoiding brittle global DOM-index math.
 */
export function findButtonInScope(
  scope: DOMWrapper<Element>,
  label: Label,
): Btn | null {
  const wanted = labels(label).map((s) => s.trim());
  const buttons = (scope.findAll('button') as Btn[]).filter(
    (b) => !isDisabled(b.element),
  );
  for (const w of wanted) {
    const exact = buttons.find((b) => b.text().trim() === w);
    if (exact) return exact;
  }
  for (const w of wanted) {
    const partial = buttons.find((b) => b.text().trim().includes(w));
    if (partial) return partial;
  }
  return null;
}

/** Click a button located by visible text within a scope element. Throws if missing. */
export async function clickButtonInScope(
  scope: DOMWrapper<Element>,
  label: Label,
): Promise<void> {
  const btn = findButtonInScope(scope, label);
  if (!btn) {
    const available = scope
      .findAll('button')
      .map((b) => `"${b.text().trim()}"`)
      .join(', ');
    throw new Error(
      `clickButtonInScope: no enabled button matching ${JSON.stringify(label)}. ` +
        `Available buttons in scope: [${available}]`,
    );
  }
  await btn.trigger('click');
  await flushPromises();
}

// ── Reset ──────────────────────────────────────────────────────────────────
// `.viz-btn--danger` is also used for destructive demo actions (Abort / Crash /
// Tamper / Send Failure), so reset must be located by its label, not its class.
// Note: most components label their reset control "Reset"/"重置"; a few use
// "Reset All"/"全部重置" (CircuitBreaker, ArenaAllocator) or "Clear All"/"全部清除"
// (BitmaskViz). Exact-match passes run before contains-match (see
// findButtonByText) so "Reset" never grabs an unrelated "Timeout Reset".
export const RESET_LABELS = [
  'Reset All',
  'Reset',
  'Clear All',
  '全部重置',
  '重置',
  '全部清除',
];

/** Click the reset control (located by label, never by .viz-btn--danger). */
export async function clickReset(wrapper: AnyWrapper): Promise<boolean> {
  const btn = findButtonByText(wrapper, RESET_LABELS);
  if (!btn) return false;
  await btn.trigger('click');
  await flushPromises();
  return true;
}

// ── VizPlaybackBar (located by aria-label) ───────────────────────────────────
const PLAYBACK = {
  skipStart: ['Skip to start', '跳到开头'],
  stepBack: ['Step back', '后退一步'],
  stepForward: ['Step forward', '前进一步'],
  skipEnd: ['Skip to end', '跳到末尾'],
} as const;

/** Whether the playback bar is currently shown (progressive disclosure). */
export function playbackVisible(wrapper: AnyWrapper): boolean {
  return wrapper.find('.viz-playback').exists();
}

/** Read the playback counter "{idx+1}/{total}" → { idx, total } (1-based idx as shown). */
export function playbackCounter(
  wrapper: AnyWrapper,
): { idx: number; total: number } | null {
  const el = wrapper.find('.viz-playback__counter');
  if (!el.exists()) return null;
  const [a, b] = el.text().split('/');
  return { idx: parseInt(a ?? '0', 10), total: parseInt(b ?? '0', 10) };
}

async function clickPlayback(wrapper: AnyWrapper, label: Label): Promise<boolean> {
  const el = findByAriaLabel(wrapper, label);
  if (!el) return false;
  await el.trigger('click');
  await flushPromises();
  return true;
}

export const playbackStepBack = (w: AnyWrapper) => clickPlayback(w, PLAYBACK.stepBack as unknown as string[]);
export const playbackStepForward = (w: AnyWrapper) => clickPlayback(w, PLAYBACK.stepForward as unknown as string[]);
export const playbackSkipStart = (w: AnyWrapper) => clickPlayback(w, PLAYBACK.skipStart as unknown as string[]);
export const playbackSkipEnd = (w: AnyWrapper) => clickPlayback(w, PLAYBACK.skipEnd as unknown as string[]);

// ── Timer settling ───────────────────────────────────────────────────────────
/** Advance fake timers in steps so chained safeTimeout/await delay() chains resolve. */
export async function settle(steps = 12, stepMs = 500): Promise<void> {
  for (let i = 0; i < steps; i++) {
    vi.advanceTimersByTime(stepMs);
    await flushPromises();
  }
}
