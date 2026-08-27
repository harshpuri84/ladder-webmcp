/**
 * The authority boundary between two humans.
 *
 * A standing rule (core/policy.ts) says how far the *agent* may go before a human sees it.
 * This says how far *this human* may go at all. They are not the same bound and they do not
 * belong on the same object:
 *
 *  - A policy is granted upward, by the operator, to the machine. An authority limit is
 *    imposed downward, on the operator, by the organisation. The operator cannot ratify their
 *    own spend limit, and there is no second person for them to ratify it on behalf of.
 *  - A policy lapses. Lapsing is the safe direction for a grant — autonomy that expires falls
 *    back to review. It is the unsafe direction for a bound: an expired spend limit would
 *    leave the operator with no limit at all, which is the opposite of what expiry is for.
 *  - `Policy.maxValue` caps the value of a whole diff. A spend authority caps one shipment.
 *    A run of forty free rebookings and one EUR 900 freighter is inside any sane total and
 *    outside this operator's authority, and one field cannot mean both.
 *
 * So this is deliberately its own small module rather than a field bolted onto Policy — which
 * would in any case mean editing `src/core/`, and core holds no domain or personnel concepts.
 * It reuses the *machinery* the adapter already has around policy (module-scope state, change
 * listeners, a `describe` function, re-registration of the tool's description) so there is one
 * pattern in this layer, not two.
 *
 * There is no auth here and no backend. `setRole` is a labelled demonstration control, in the
 * same class as "Simulate a buggy tool": it switches which role this one browser is acting as,
 * so both sides of the boundary can be seen. It is never a claim that two people are signed in.
 */

export interface AuthorityRole {
  id: string;
  /** What the strip and every receipt call this person. */
  label: string;
  /** The most this role may commit on a single shipment, in EUR. */
  spendLimitEur: number;
}

/**
 * Ordered by authority, lowest first. A row above one role's limit is referred to the next
 * role in this list — so the order is the escalation path, not decoration.
 */
export const ROLES: AuthorityRole[] = [
  { id: 'gateway-operator', label: 'Gateway operator', spendLimitEur: 250 },
  { id: 'duty-manager', label: 'Duty manager', spendLimitEur: 5000 },
];

const listeners = new Set<() => void>();
let currentRoleId = ROLES[0].id;

export function onRoleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function currentRole(): AuthorityRole {
  return ROLES.find(r => r.id === currentRoleId) ?? ROLES[0];
}

/** No-op for an unknown id, and for the role already in effect — listeners only fire on a change. */
export function setRole(id: string): void {
  if (id === currentRoleId) return;
  if (!ROLES.some(r => r.id === id)) return;
  currentRoleId = id;
  listeners.forEach(fn => fn());
}

/** Whoever a row above `role`'s limit goes to, or null when this role is the top of the ladder. */
export function referralTarget(role: AuthorityRole): AuthorityRole | null {
  const next = ROLES[ROLES.findIndex(r => r.id === role.id) + 1];
  return next ?? null;
}

/**
 * Spend is read as a magnitude: a remedy that gave money back would still be a decision of the
 * same size, and this bound is about the size of the decision.
 */
export function isReferable(spendEur: number, role: AuthorityRole): boolean {
  return Math.abs(spendEur) > role.spendLimitEur;
}

export const describeAuthority = (r: AuthorityRole): string =>
  `may authorise up to EUR ${r.spendLimitEur} on one shipment`;
