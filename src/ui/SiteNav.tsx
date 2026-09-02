import { TabBar } from './TabBar';
import type { TabId } from './useTab';

/**
 * The site's own bar: the name on the left, the sections in the middle, the way in on the right.
 *
 * The three sections used to be index tabs cut into the head of the sheet, sitting *under* the
 * landing page's hero. That read as a marketing page with a tabbed widget bolted beneath it:
 * a reader who came for the claim met a control that belonged to a different document. The
 * sections have not changed and neither has their behaviour; only where they sit has.
 *
 * It stays a `tablist`, because that is what it is: three panels in one document, one open at a
 * time, no navigation. Presenting it as a bar does not make it a set of links, and calling it
 * one would lie to a screen reader about what pressing it does.
 */
export function SiteNav({ tab, setTab }: { tab: TabId; setTab(t: TabId): void }) {
  return (
    <header className="nav">
      <div className="nav-in">
        <button
          type="button"
          className="nav-brand"
          onClick={() => setTab('problem')}
          aria-label="Ladder, back to the top"
        >
          Ladder
        </button>
        <TabBar tab={tab} setTab={setTab} />
      </div>
    </header>
  );
}
