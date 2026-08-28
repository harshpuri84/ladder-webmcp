/**
 * The authority boundary between two humans.
 *
 * A standing rule (core/policy.ts) says how far the *agent* may go before a human sees it.
 * This says how far *this human* may go at all. They are not the same bound and they do not
 * belong on the same object:
 *
 *  - A policy is granted upward, by the operator, to the machine. An authority limit is
 *    imposed downward, on the operator, by the organisation. The operator cannot ratify their
 *    own limit, and there is no second person for them to ratify it on behalf of.
 *  - A policy lapses. Lapsing is the safe direction for a grant — autonomy that expires falls
 *    back to review. It is the unsafe direction for a bound: an expired limit would leave the
 *    operator with no limit at all, which is the opposite of what expiry is for.
 *  - `Policy.maxValue` caps the value of a whole diff. An authority limit caps one record.
 *    A run of forty free changes and one large one is inside any sane total and outside this
 *    operator's authority, and one field cannot mean both.
 *
 * So this is deliberately its own small module rather than a field bolted onto Policy — which
 * would in any case mean editing `src/core/`, and core holds no domain or personnel concepts.
 * It reuses the *machinery* the adapter already has around policy (module-scope state, change
 * listeners, a `describe` function, re-registration of the tool's description) so there is one
 * pattern in this layer, not two.
 *
 * **Nothing here names a unit, a record or a role.** Every one of those is the host's, handed
 * over once through `HostBinding.authority` (see `configureHost` in adapter.ts) and read back
 * out here. That is what lets a second product get this same two-human mechanic measured in
 * something that is not money: the freight console says "EUR 250 on one shipment", the edge
 * console says "0.50% of production traffic on one site", and this module says neither.
 *
 * There is no auth here and no backend. `setRole` is a labelled demonstration control, in the
 * same class as "Simulate a buggy tool": it switches which role this one browser is acting as,
 * so both sides of the boundary can be seen. It is never a claim that two people are signed in.
 */

export interface AuthorityRole {
  id: string;
  /** What the strip and every receipt call this person. */
  label: string;
  /** The most this role may commit on a single record, in the host's own units. Rendered by
   *  the vocabulary's `amount()` and never by this module. */
  limit: number;
}

/**
 * One product's words for its own authority boundary. Five things, because five is what it takes
 * to write the sentence the agent reads without the engine knowing what the product sells.
 */
export interface AuthorityVocabulary {
  /**
   * Ordered by authority, lowest first. A record above one role's limit is referred to the next
   * role in this list — so the order is the escalation path, not decoration.
   */
  roles: AuthorityRole[];
  /** One record, in this product's word for it: "shipment", "site". */
  record: string;
  /** The bound, named, as a referral reason says it: "spend authority", "exposure authority". */
  bound: string;
  /**
   * The condition under which the bound bites at all, completing "Where a proposed change ___":
   * "carries a cost", "puts production traffic in front of a release". Opened on the condition
   * rather than stated flat so the sentence stays true of a change that carries nothing.
   */
  carries: string;
  /** A magnitude in this product's units: 250 -> "EUR 250"; 3 -> "3.00% of production traffic". */
  amount(n: number): string;
}

/**
 * What this module says before a host has handed its words over. Deliberately not an error: a
 * tool may be registered before `configureHost` runs (see `host-binding.test.ts`), and a
 * registration must not throw. Every guarded path that could act on a bound goes through
 * `host()` in adapter.ts first and fails loudly there instead, and `composedDescription` omits
 * the authority sentence entirely while `configured` is false — an unbound module has no host
 * whose boundary it could honestly state.
 */
const UNBOUND: AuthorityVocabulary = {
  roles: [],
  record: 'record',
  bound: 'authority',
  carries: 'carries value',
  amount: (n: number) => String(n),
};

/** Total, so `currentRole()` never returns undefined on the unbound path above. */
const UNBOUND_ROLE: AuthorityRole = {
  id: '', label: 'operator', limit: Number.POSITIVE_INFINITY,
};

let vocab: AuthorityVocabulary = UNBOUND;
let configured = false;

/**
 * Ordered by authority, lowest first — the host's roles, live.
 *
 * Mutated in place rather than reassigned on purpose: `src/ui/AuthorityStrip.tsx` and several
 * suites capture this array once and read it later, and a rebinding export would leave them
 * holding the empty unbound list forever.
 */
export const ROLES: AuthorityRole[] = [];

const listeners = new Set<() => void>();
let currentRoleId = '';

/**
 * Called once by `configureHost`, before any tool runs. Replaces the roles and the words, and
 * puts the operator back on the lowest rung of the new ladder — carrying a role id across two
 * different products' ladders would be meaningless, and silently keeping the highest one would
 * be unsafe.
 *
 * Fires the role listeners, which is what re-registers every already-registered tool with a
 * description that finally states this host's boundary. In both products the registration call
 * comes after this one, so that loop is empty and this is free.
 */
export function configureAuthority(v: AuthorityVocabulary): void {
  vocab = v;
  configured = true;
  ROLES.splice(0, ROLES.length, ...v.roles);
  currentRoleId = ROLES[0]?.id ?? '';
  listeners.forEach(fn => fn());
}

/** The host's words. Always a whole object; see UNBOUND for what it is before binding. */
export function authorityVocabulary(): AuthorityVocabulary {
  return vocab;
}

/** False until a host has handed its words over. Read by `composedDescription`. */
export function authorityConfigured(): boolean {
  return configured;
}

export function onRoleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function currentRole(): AuthorityRole {
  return ROLES.find(r => r.id === currentRoleId) ?? ROLES[0] ?? UNBOUND_ROLE;
}

/** No-op for an unknown id, and for the role already in effect — listeners only fire on a change. */
export function setRole(id: string): void {
  if (id === currentRoleId) return;
  if (!ROLES.some(r => r.id === id)) return;
  currentRoleId = id;
  listeners.forEach(fn => fn());
}

/** Whoever a record above `role`'s limit goes to, or null when this role is the top of the ladder. */
export function referralTarget(role: AuthorityRole): AuthorityRole | null {
  const next = ROLES[ROLES.findIndex(r => r.id === role.id) + 1];
  return next ?? null;
}

/**
 * The value is read as a magnitude: a change that gave value back would still be a decision of
 * the same size, and this bound is about the size of the decision.
 */
export function isReferable(value: number, role: AuthorityRole): boolean {
  return Math.abs(value) > role.limit;
}

export const describeAuthority = (r: AuthorityRole): string =>
  `may authorise up to ${vocab.amount(r.limit)} on one ${vocab.record}`;
