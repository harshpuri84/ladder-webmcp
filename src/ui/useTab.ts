import { useEffect, useState } from 'react';

export type TabId = 'problem' | 'proof' | 'elsewhere';

const TABS: TabId[] = ['problem', 'elsewhere', 'proof'];

/**
 * The tab lives in the hash rather than in state alone so a judge can be sent straight to one,
 * the video automation can jump to a beat without clicking, and the browser's own back button
 * does what it looks like it does.
 */
function readHash(): TabId {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return TABS.find(t => t === raw) ?? 'problem';
}

export function useTab(): { tab: TabId; setTab(t: TabId): void } {
  const [tab, setTabState] = useState<TabId>(readHash);

  // A hash changed outside React — the back button, a pasted link, the demo automation —
  // has to move the tab too, or the address bar and the page disagree.
  useEffect(() => {
    const onHash = () => setTabState(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setTab = (t: TabId) => {
    window.location.hash = `#/${t}`;
    setTabState(t);
  };

  return { tab, setTab };
}
