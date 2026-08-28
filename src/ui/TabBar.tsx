import { useRef } from 'react';
import type { TabId } from './useTab';

const TAB_ORDER: { id: TabId; label: string }[] = [
  { id: 'problem', label: 'The problem' },
  { id: 'proof', label: 'The proof' },
  { id: 'elsewhere', label: 'Same engine, other work' },
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
 * Index tabs cut into the head of the sheet, which is what a proof sheet in a job bag actually
 * has. Four signals say which one is open and not one of them is a hue:
 *
 *   — stock: the open tab is on the same paper as the sheet below it, the closed ones on the
 *     duller stock behind;
 *   — continuity: the open tab breaks the sheet's head rule, so tab and sheet are one surface,
 *     while a closed tab is shut off from it by that same rule running past;
 *   — height: a closed tab sits lower, the way a tab behind another one does;
 *   — weight: the open tab's label is set at 600 in the full ink.
 *
 * The blue top edge is the fifth thing and the only optional one. It agrees with the four; the
 * operator this is built for has red-green colour vision deficiency, so it is never asked to
 * carry the state on its own. Render the page in greyscale and every signal above survives.
 *
 * The tab is also a real object now rather than a word in a row: ~44px of hit target, a border
 * on three sides, and a background you can aim at.
 */
export function TabBar({ tab, setTab }: TabBarProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    const to = (from + delta + TAB_ORDER.length) % TAB_ORDER.length;
    setTab(TAB_ORDER[to].id);
    buttonRefs.current[to]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(index, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(index, -1); }
  };

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
            className={active ? 'tab-bar-tab tab-bar-tab--active' : 'tab-bar-tab'}
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
