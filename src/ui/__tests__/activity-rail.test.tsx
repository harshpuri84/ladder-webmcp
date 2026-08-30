// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ActivityList } from '../ActivityList';
import App from '../../App';
// The shipped stylesheet as text, the same `?raw` device `ElsewherePage.test.tsx` uses. Reading
// the sheet is the only way to see any of this: jsdom has no layout engine, so a rendered rail
// has no computed `position` to interrogate and no height to measure. `test: { css: true }` in
// vite.config.ts is what makes this return the real file rather than an empty string.
import CSS from '../styles.css?raw';

/** The declarations of one flat rule — none of the blocks read here nests. */
function block(selector: string): string {
  const at = CSS.indexOf(`\n${selector} {\n`);
  expect(at, `no rule for \`${selector}\``).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', at);
  const close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
}

/** A whole at-rule, braces balanced, so its inner rules can be read in isolation. */
function atRule(prelude: string): string {
  const at = CSS.indexOf(`${prelude} {`);
  expect(at, `no at-rule \`${prelude}\``).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = CSS.indexOf('{', at); i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    else if (CSS[i] === '}' && --depth === 0) return CSS.slice(at, i + 1);
  }
  throw new Error(`unbalanced braces after \`${prelude}\``);
}

/**
 * The run log has to still be on screen while a judge is reading the register, because the
 * register is where the outcomes it logs actually land. It was not: `.app-shell` is
 * `align-items: flex-start`, which sizes every child to its own content, and `position: sticky`
 * can only travel inside its own containing box. The rail's box was as tall as its own lines,
 * so it stuck for a few pixels and then left with the scroll for good — and a cold load of
 * `#/proof` opened past it.
 *
 * The fix is a chain: the shell's own child stretched to the height of the sheet, a bare column
 * filling it, and the visible slip inside that, which is the only part that sticks. jsdom has
 * no layout engine, so nothing here can measure a scroll — that was done in a real browser at
 * 1512px and at 1024px. What is checked here is the contract that made those measurements come
 * out right, because that is the part which decays quietly: flatten the slip back into the
 * rail, move `sticky` back onto the short box, or re-wrap the rail in App.tsx, and it silently
 * stops following the page again with nothing failing.
 *
 * The three rules the fix was not allowed to disturb are asserted beside it — the panel's
 * reserved width, the rail's disappearance during a decision, and the shell still stacking
 * every other child at the top. None of them is visible from `ActivityList.tsx`.
 */
describe('the returned-proofs rail follows the page', () => {
  beforeEach(() => { window.location.hash = ''; });
  afterEach(() => { cleanup(); window.location.hash = ''; });

  it('draws the slip inside the rail, not as the rail itself', () => {
    const { container } = render(<ActivityList />);
    const rail = container.querySelector('.al')!;
    const panel = rail.querySelector(':scope > .al-panel');

    expect(panel, 'the rail lost its inner panel').not.toBeNull();
    // Everything drawn is the panel's, so the column around it can carry no paper of its own.
    expect(rail.children.length).toBe(1);
    expect(panel!.querySelector('.al-heading')?.textContent).toBe('Proofs returned');
    expect(panel!.querySelector('.al-empty')).not.toBeNull();
    // The landmark stays on the element the rest of the sheet already addresses as `.al`.
    expect(rail.tagName).toBe('ASIDE');
    expect(rail.getAttribute('aria-label')).toBe('Activity');
  });

  it('hangs the whole chain off the shell, wrapper included', () => {
    // The one that caught the first attempt at this fix. `.al` is not the shell's child —
    // App.tsx wraps it so it survives a tab change — so stretching `.al` stretched nothing and
    // the rail still scrolled away. Every link between the shell and the sticky slip is named
    // here, because the CSS below is written against exactly this chain.
    window.location.hash = '#/proof';
    render(<App />);
    expect(
      document.querySelector('.app-shell > .app-rail > .al > .al-panel'),
      'the rail no longer hangs off the shell the way the stylesheet expects',
    ).not.toBeNull();
  });

  it('stretches the column and sticks the slip inside it', () => {
    // The wrapper is the shell's flex item, so the wrapper is what opts out of `flex-start`.
    expect(block('.app-shell > .app-rail')).toMatch(/align-self:\s*stretch/);

    const outer = block('.al');
    // And the rail fills it, which is what gives the slip room to travel.
    expect(outer).toMatch(/height:\s*100%/);
    // The whole defect in one line: a sticky box that is only as tall as its own content.
    expect(outer, 'sticky moved back onto the short box').not.toMatch(/position:\s*sticky/);

    const inner = block('.al-panel');
    expect(inner).toMatch(/position:\s*sticky/);
    expect(inner).toMatch(/top:\s*34px/);
    // The paper, the rule and the padding belong to the visible slip, not to the column.
    expect(inner).toMatch(/border:\s*1px solid var\(--rule-strong\)/);
    expect(inner).toMatch(/background:\s*var\(--paper\)/);
  });

  it('leaves the shell stacking every other child at the top', () => {
    // Stretching the rail had to be done from the rail. Every other child of the shell is
    // sized to its own content and would be a much larger change to stretch.
    expect(block('.app-shell')).toMatch(/align-items:\s*flex-start/);
  });

  it('keeps the panel its reserved width, and hides the rail during a decision', () => {
    expect(block('body.pp-active .app-shell')).toMatch(/margin-right:\s*var\(--panel-width\)/);
    expect(block('body.pp-active .al')).toMatch(/display:\s*none/);
  });

  it('gives up sticking where the shell stacks', () => {
    // Below this line the rail is a block at the foot of the sheet. There is no column beside
    // the register to travel down, so a sticky slip there would only pin itself to the bottom.
    const narrow = atRule('@media (max-width: 1080px)');
    expect(narrow).toMatch(/\.al-panel\s*\{[^}]*position:\s*static/);
    expect(narrow).toMatch(/\.al-panel\s*\{[^}]*max-height:\s*none/);
    expect(narrow).toMatch(/\.al\s*\{[^}]*width:\s*100%/);
    expect(narrow).toMatch(/\.al\s*\{[^}]*height:\s*auto/);
    expect(narrow).toMatch(/flex-direction:\s*column/);
  });
});
