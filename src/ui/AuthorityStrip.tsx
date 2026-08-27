import { useEffect, useState } from 'react';
import {
  listReferrals, onReferralsChange, reviewReferral, type Referral,
} from '../webmcp/adapter';
import {
  ROLES, currentRole, describeAuthority, onRoleChange, referralTarget, setRole,
} from '../webmcp/authority';
import { ProofMark } from './ProofMark';
import { money } from './remedy-words';

/**
 * The authority boundary, stated where the standing rules are stated — because they are the
 * two halves of the same question and an operator should read them together. A standing rule
 * says how far the agent may go without this person. This says how far this person may go
 * without a second one.
 *
 * The role switch is a labelled demonstration, in the same class as the register's "Simulate a
 * buggy tool" toggle, and it says so in the same plain words. There is no sign-in here, no
 * server and no second session: it changes which role this one browser is acting as, so both
 * sides of the boundary can be seen and driven. Anything stronger would be a claim the code
 * cannot back.
 */
function ReferralRow({ referral, canReview }: { referral: Referral; canReview: boolean }) {
  return (
    <li className="au-ref">
      <div className="au-ref-body">
        <p className="au-ref-line">
          <span className="mono">{referral.ids.length}</span>{' '}
          {referral.ids.length === 1 ? 'shipment' : 'shipments'} ·{' '}
          <span className="mono">{money(referral.spendEur)}</span> · referred by the{' '}
          {referral.fromRole.toLowerCase()} from{' '}
          <span className="mono">{referral.toolName}</span>
        </p>
        <p className="au-ref-ids mono">{referral.ids.join(', ')}</p>
      </div>
      <button
        className="au-ref-review"
        type="button"
        disabled={!canReview}
        onClick={() => { void reviewReferral(referral.id); }}
        title={canReview
          ? undefined
          : `Only the ${referral.toRole.toLowerCase()} can decide this. Switch role above to see that side.`}
      >
        {canReview ? `Review as ${referral.toRole.toLowerCase()}` : `Waiting on the ${referral.toRole.toLowerCase()}`}
      </button>
    </li>
  );
}

export function AuthorityStrip() {
  // Neither the role nor the referral queue is copied into React state — both are read fresh
  // on every render, exactly the way RungStrip reads activePolicy(). These counters are never
  // read; bumping them is only ever how a change out in the adapter forces that render.
  const [, setTick] = useState(0);
  useEffect(() => onRoleChange(() => setTick(t => t + 1)), []);
  useEffect(() => onReferralsChange(() => setTick(t => t + 1)), []);

  const role = currentRole();
  const target = referralTarget(role);
  const referrals = listReferrals();

  return (
    <section className="au" aria-label="Spend authority">
      <p className="au-heading">Spend authority</p>

      <div className="au-roles" role="group" aria-label="Acting as">
        {ROLES.map(r => {
          const active = r.id === role.id;
          return (
            <button
              key={r.id}
              className={`au-role${active ? ' au-role--on' : ''}`}
              type="button"
              aria-pressed={active}
              onClick={() => setRole(r.id)}
            >
              {active && <ProofMark name="insert" size={12} />}
              <span className="au-role-name">{r.label}</span>
              <span className="au-role-limit mono">EUR {r.spendLimitEur}</span>
            </button>
          );
        })}
      </div>

      <p className="au-state">
        <span className="au-state-caps">Acting as</span> {role.label} — {describeAuthority(role)}
        {target
          ? `. Anything above that is referred to a ${target.label.toLowerCase()}.`
          : '. Nothing is referred above this role.'}
      </p>

      <p className="au-demo-note">
        There is no sign-in here and no server. This switches the labelled role in this one
        browser so both sides of the boundary can be driven — a deliberate demonstration, like
        the register&rsquo;s buggy-tool toggle, never a claim that two people are signed in.
      </p>

      {referrals.length > 0 && (
        <div className="au-refs">
          <p className="au-refs-caption">
            <ProofMark name="query" size={13} />
            <span className="au-refs-caption-caps">Referred — awaiting a second approver</span>
          </p>
          <ul className="au-refs-list">
            {referrals.map(r => (
              <ReferralRow key={r.id} referral={r} canReview={r.toRoleId === role.id} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
