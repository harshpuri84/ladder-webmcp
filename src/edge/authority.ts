import type { AuthorityRole, AuthorityVocabulary } from '../webmcp/authority';

/**
 * This product's half of the authority boundary. Same mechanic as the freight console — one
 * human's limit, a second human above them, enforced in the commit and stated in the tool's own
 * description — measured in something that is not money.
 *
 * The figure is **share of production traffic put in front of an unproven release at one site**.
 * It is the number this estate actually argues about: a staged rollout at Amsterdam exposes
 * 0.91% of everything the network serves, and an immediate one would expose 9.1%. Nothing here
 * costs anything, and the boundary is no weaker for it.
 */
export const EDGE_ROLES: AuthorityRole[] = [
  // Half a percent. Deliberately below the largest staged rollout in the estate (Amsterdam at
  // 0.91%), so the boundary bites on the ordinary path rather than only on a forced `mode`.
  // An earlier draft sat at 3%, which cleared every default rollout the estate can produce and
  // left the second human with nothing to do unless someone went looking for them — a boundary
  // that never binds is decoration. This one puts the flagship sites in front of a second person
  // on the plainest call the tool has, which is what the mechanic is for.
  { id: 'release-engineer', label: 'Release engineer', limit: 0.5 },
  // Above every exposure this estate can produce at one site, so the ladder has a real top.
  { id: 'traffic-lead', label: 'Traffic lead', limit: 10 },
];

/**
 * The five fields the engine composes every agent-facing sentence from. Read the result out of
 * `roll_config`'s registered description:
 *
 *   "Where a proposed change puts production traffic in front of a release, the operator on
 *    shift is a release engineer and may authorise up to 0.50% of production traffic on one
 *    site; anything above that is referred to a traffic lead and is not applied by this call."
 *
 * No currency, no shipment, and not one word of it written in this repository twice.
 */
export const edgeAuthority: AuthorityVocabulary = {
  roles: EDGE_ROLES,
  record: 'site',
  bound: 'exposure authority',
  carries: 'puts production traffic in front of a release',
  // Two decimals, matching every other exposure figure on this instrument (see `pct` in
  // ui/words.ts) — a rollout that exposes a twentieth of a percent has to read as one.
  amount: (n: number) => `${n.toFixed(2)}% of production traffic`,
};
