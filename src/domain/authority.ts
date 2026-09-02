import type { AuthorityRole, AuthorityVocabulary } from '../webmcp/authority';

const euro = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * This product's half of the authority boundary: who the two humans are, what bounds them, and
 * the words every sentence about it is written in. `src/webmcp/authority.ts` owns the mechanic
 * and none of the vocabulary; this file is where the euros live.
 */

/**
 * Ordered by authority, lowest first. A shipment above one role's limit is referred to the next
 * role in this list — so the order is the escalation path, not decoration.
 *
 * `limit` is euros here and the engine does not know that. It is the vocabulary below that turns
 * 250 into "€250", which is why the same two numbers can be a currency in this product and a
 * share of traffic in the other one.
 */
export const FREIGHT_ROLES: AuthorityRole[] = [
  { id: 'gateway-operator', label: 'Gateway operator', limit: 250 },
  { id: 'duty-manager', label: 'Duty manager', limit: 5000 },
];

/**
 * The exact words this console has always used, now supplied rather than assumed. Every string
 * the agent reads about the boundary is composed from these five fields:
 *
 *   "Where a proposed change carries a cost, the operator on shift is a gateway operator and
 *    may authorise up to €250 on one shipment; anything above that is referred to a duty
 *    manager and is not applied by this call."
 */
export const freightAuthority: AuthorityVocabulary = {
  roles: FREIGHT_ROLES,
  record: 'shipment',
  bound: 'spend authority',
  carries: 'carries a cost',
  // The same form every other euro figure in this console takes, on the sheet and in the
  // register: the glyph, then the figure, no decimals. Until 2 Sep 2026 this alone said
  // "EUR 250" while the sheet beside it said "€326".
  amount: (n: number) => euro.format(n),
};
