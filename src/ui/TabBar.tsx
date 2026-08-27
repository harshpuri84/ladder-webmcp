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

/**
 * The active tab is said by weight and an underline rule — never by colour alone, since the
 * operator this whole product is built for has red-green colour vision deficiency. Colour on
 * the active tab only ever agrees with what the weight and rule already said.
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
    <>
      <div className="tab-bar" role="tablist" aria-label="Ladder sections">
        {TAB_ORDER.map(({ id, label }, i) => {
          const active = tab === id;
          return (
            <button
              key={id}
              ref={el => { buttonRefs.current[i] = el; }}
              type="button"
              role="tab"
              aria-selected={active}
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
      <hr className="rule tab-bar-rule" />
    </>
  );
}
