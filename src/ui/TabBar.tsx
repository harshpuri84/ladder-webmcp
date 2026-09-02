import { useRef } from 'react';
import type { TabId } from './useTab';

// Reading order on the bar, which is also the order the arrow keys walk. The proof is last
// because it is drawn as the bar's action and an action belongs at the end of a bar, not in
// the middle of the words.
const TAB_ORDER: { id: TabId; label: string }[] = [
  { id: 'problem', label: 'The problem' },
  { id: 'elsewhere', label: 'Same engine, other work' },
  { id: 'proof', label: 'The proof' },
];

interface TabBarProps {
  tab: TabId;
  setTab(t: TabId): void;
}

/** The one tabpanel's id, shared with App.tsx so each tab button's `aria-controls` and the
 *  panel's own id actually agree — a screen reader announcing a tab as controlling a panel that
 *  does not exist (or the wrong one) is worse than no association at all. */
export const TABPANEL_ID = 'ladder-tabpanel';

/** A tab button's id, shared with App.tsx so the panel's `aria-labelledby` can point at whichever
 *  button is currently active, by the same rule this file and App.tsx both use to build it. */
export const tabButtonId = (id: TabId) => `tab-${id}`;

/**
 * The three sections, drawn as words on the site bar with the proof as its one action.
 *
 * Three signals say which section is open and not one of them is a hue: weight, the full ink,
 * and a rule on the bar's own bottom edge under the open word. The operator this is built for
 * has red-green colour vision deficiency; render the bar in greyscale and all three survive.
 *
 * These were index tabs cut into the head of the sheet until 2 Sep 2026. On the landing page
 * that put them below the hero, where they read as a widget from another document bolted under
 * a marketing page. See SiteNav.tsx.
 */
export function TabBar({ tab, setTab }: TabBarProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const goTo = (to: number) => {
    setTab(TAB_ORDER[to].id);
    buttonRefs.current[to]?.focus();
  };

  const move = (from: number, delta: number) =>
    goTo((from + delta + TAB_ORDER.length) % TAB_ORDER.length);

  // The roving-tabindex contract in full. Home and End are not a nicety on top of the arrows:
  // a tablist that moves on ArrowRight and does nothing on End has taught the operator a
  // convention it then breaks, which is worse than never having claimed it.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(index, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(index, -1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(TAB_ORDER.length - 1); }
  };

  // The name stood at the far end of this row on the two working tabs until 2 Sep 2026, at the
  // tab labels' own size and weight, and read as a fourth tab. The tabs are the row.
  return (
    <div className="tab-bar" role="tablist" aria-label="Ladder sections">
      {TAB_ORDER.map(({ id, label }, i) => {
        const active = tab === id;
        return (
          <button
            key={id}
            id={tabButtonId(id)}
            ref={el => { buttonRefs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={TABPANEL_ID}
            tabIndex={active ? 0 : -1}
            className={[
              'tab-bar-tab',
              // The proof is the way in, so the bar draws it as its one action rather than as a
              // third word. Same control, same role, same keys; it only looks like what it is
              // for. Every other state class still lands on it.
              id === 'proof' ? 'tab-bar-tab--cta' : '',
              active ? 'tab-bar-tab--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setTab(id)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
