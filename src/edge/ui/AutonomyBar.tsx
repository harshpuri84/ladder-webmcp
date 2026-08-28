import { useEffect, useState } from 'react';
import type { Policy } from '../../core/policy';
import { activePolicy, onDraft, onPolicyChange, ratify, revoke } from '../../webmcp/adapter';
import { pct } from './words';

const GUARDED = 'roll_config';

const sites = (n: number) => `${n} ${n === 1 ? 'site' : 'sites'}`;

/**
 * The rung. Autonomy in this product is granted by a person, has a ceiling, and lapses on its own
 * — and this bar is where that is said, in the estate's own units.
 *
 * A ratified rule carries two ceilings and both are enforced in `core/policy.ts`: how many sites
 * one call may cover, and how much production traffic the whole call may expose. The second one
 * used to be unsayable here — the adapter rendered every value cap in a fixed currency, so it
 * would have read "up to EUR 0" on a rollout tool — and this bar wrote its own sentence around
 * it. It no longer has to: the host binding hands the adapter its own unit (see
 * `src/edge/authority.ts`), and the exposure ceiling is stated below alongside the site count.
 */
export function AutonomyBar() {
  const [draft, setDraft] = useState<Policy | null>(null);
  const [, bump] = useState(0);

  useEffect(() => onDraft(p => setDraft(p)), []);
  useEffect(() => onPolicyChange(() => bump(n => n + 1)), []);

  const held = activePolicy(GUARDED);

  if (held) {
    return (
      <div className="au">
        <span className="lg">Standing rule · held</span>
        <p className="au-text">
          <strong className="rd">{GUARDED}</strong> applies up to{' '}
          <strong className="rd">{sites(held.maxRecords)}</strong> and{' '}
          <strong className="rd">{pct(held.maxValue)}</strong> of production traffic without
          review, reversible changes only, until{' '}
          <strong className="rd">{held.expiresAt.slice(0, 10)}</strong>.
        </p>
        <button className="au-btn au-btn--held" type="button" onClick={() => revoke(GUARDED)}>
          Release the rule
        </button>
      </div>
    );
  }

  if (draft && draft.tool === GUARDED) {
    return (
      <div className="au">
        <span className="lg">Standing rule · offered</span>
        <p className="au-text">
          Three runs in a row went out exactly as proposed. Hold a rule and{' '}
          <strong className="rd">{GUARDED}</strong> may stage up to{' '}
          <strong className="rd">{sites(draft.maxRecords)}</strong> at a time, exposing at most{' '}
          <strong className="rd">{pct(draft.maxValue)}</strong> of production traffic, without
          opening the drawer, until{' '}
          <strong className="rd">{draft.expiresAt.slice(0, 10)}</strong>.
        </p>
        <button className="au-btn" type="button" onClick={() => ratify(draft)}>
          Hold this rule
        </button>
      </div>
    );
  }

  return (
    <div className="au">
      <span className="lg">Standing rule · none</span>
      <p className="au-text">
        Every <strong className="rd">{GUARDED}</strong> call opens the bench drawer for review.
        A rule is offered after three runs go out exactly as proposed.
      </p>
    </div>
  );
}
