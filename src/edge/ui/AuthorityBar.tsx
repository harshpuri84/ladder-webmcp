import { useEffect, useState } from 'react';
import { listReferrals, onReferralsChange, reviewReferral, type Referral } from '../../webmcp/adapter';
import {
  ROLES, authorityVocabulary, currentRole, describeAuthority, onRoleChange, referralTarget,
  setRole,
} from '../../webmcp/authority';
import { pct } from './words';

/**
 * The second bound on this instrument, stated beside the first.
 *
 * The autonomy bar above says how far the agent may go before a person sees a rollout. This says
 * how far *this* person may go before a second one does — the same mechanic the freight console
 * carries, and not one word of it about money. What bounds a rollout here is the share of
 * production traffic it puts in front of an unproven release at one site: a release engineer may
 * expose up to 0.50%, and Amsterdam's ordinary staged rollout — one node in ten — is 0.91% and
 * therefore somebody else's call. See `src/edge/authority.ts`.
 *
 * The role switch is a labelled demonstration, in the same class as the freight console's: there
 * is no sign-in here and no server. It changes which role this one browser is acting as so both
 * sides of the boundary can be driven.
 */
function ReferralRow({ referral, canReview }: { referral: Referral; canReview: boolean }) {
  return (
    <li className="ar-ref">
      <div className="ar-ref-body">
        <p className="ar-ref-line">
          <b className="rd">{referral.ids.length}</b>{' '}
          {referral.ids.length === 1 ? 'site' : 'sites'} ·{' '}
          <b className="rd">{pct(referral.spendEur)}</b> of production traffic · referred by the{' '}
          {referral.fromRole.toLowerCase()} from <span className="rd">{referral.toolName}</span>
        </p>
        <p className="ar-ref-ids rd">{referral.ids.join(', ')}</p>
      </div>
      <button
        className="au-btn"
        type="button"
        disabled={!canReview}
        onClick={() => { void reviewReferral(referral.id); }}
        title={canReview
          ? undefined
          : `Only the ${referral.toRole.toLowerCase()} can decide this. Switch role to see that side.`}
      >
        {canReview ? `Review as ${referral.toRole.toLowerCase()}` : `Waiting on the ${referral.toRole.toLowerCase()}`}
      </button>
    </li>
  );
}

export function AuthorityBar() {
  // Neither the role nor the queue is copied into state: both are read fresh every render, the
  // way AutonomyBar reads activePolicy(). The counter is never read — bumping it is only how a
  // change out in the adapter forces the render.
  const [, setTick] = useState(0);
  useEffect(() => onRoleChange(() => setTick(t => t + 1)), []);
  useEffect(() => onReferralsChange(() => setTick(t => t + 1)), []);

  const role = currentRole();
  const target = referralTarget(role);
  const referrals = listReferrals();

  return (
    <section className="ar" aria-label="Exposure authority">
      <div className="ar-top">
        <span className="lg">Exposure authority</span>

        <div className="ar-roles" role="group" aria-label="Acting as">
          {ROLES.map(r => {
            const active = r.id === role.id;
            return (
              <button
                key={r.id}
                className={`ar-role${active ? ' ar-role--on' : ''}`}
                type="button"
                aria-pressed={active}
                onClick={() => setRole(r.id)}
              >
                {/* The filled latch, the word and the border all say the same thing, so which
                    role is in effect never rests on colour alone. */}
                <span className="dt-latch" aria-hidden="true" />
                <span className="ar-role-name">{r.label}</span>
                <span className="ar-role-limit rd">{authorityVocabulary().amount(r.limit)}</span>
              </button>
            );
          })}
        </div>

        <p className="au-text ar-state">
          Acting as <strong>{role.label}</strong> — {describeAuthority(role)}
          {target
            ? `. Anything above that is referred to a ${target.label.toLowerCase()}, never quietly refused.`
            : '. Nothing is referred above this role.'}
        </p>
      </div>

      <p className="ar-note">
        No sign-in and no server: this switches the labelled role in one browser so both sides of
        the boundary can be driven. A deliberate demonstration, never a claim that two people are
        signed in.
      </p>

      {referrals.length > 0 && (
        <ul className="ar-refs">
          {referrals.map(r => (
            <ReferralRow key={r.id} referral={r} canReview={r.toRoleId === role.id} />
          ))}
        </ul>
      )}
    </section>
  );
}
