import { useEffect, useState } from 'react';
import type { Policy } from '../../core/policy';
import { activePolicy, onDraft, onPolicyChange, ratify, revoke } from '../../webmcp/adapter';

const GUARDED = 'roll_config';

const sites = (n: number) => `${n} ${n === 1 ? 'site' : 'sites'}`;

/**
 * The rung. Autonomy in this product is granted by a person, has a ceiling, and lapses on its own
 * — and this bar is the only place any of that is said, so it says it in the estate's own units.
 *
 * It reads `maxRecords` and the expiry off the policy and writes the sentence itself rather than
 * calling the adapter's `describePolicy`, which renders a policy's value cap in a fixed currency.
 * Nothing here carries money (see `edgeHost.valueDeltaOf`), so that sentence would read
 * "up to EUR 0" on a rollout tool. See task-edge-report.md — the host binding cannot currently
 * hand the adapter its own units, and this is the one place a second product notices.
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
          <strong className="rd">{sites(held.maxRecords)}</strong> without review, reversible
          changes only, until <strong className="rd">{held.expiresAt.slice(0, 10)}</strong>.
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
          <strong className="rd">{sites(draft.maxRecords)}</strong> at a time without opening the
          drawer, until <strong className="rd">{draft.expiresAt.slice(0, 10)}</strong>.
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
