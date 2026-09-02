import { runShadow } from '../core/shadow';
import { store, freightHost } from '../domain/store';
import { proposeRemedy } from '../domain/tools';
import { FREIGHT_ROLES } from '../domain/authority';
import { isReferable } from '../webmcp/authority';
import type { PendingProposal } from '../webmcp/adapter';

/** The call the specimen sheet shows: the whole of the cancelled flight's first consolidation. */
export const SPECIMEN_INPUT = { consol: 'CONSOL-A' } as const;

/**
 * The proof sheet for `propose_remedy` on CONSOL-A, built the way a live call builds one:
 * the tool's own `execute()` run against a fork of the register, read by the operator on
 * shift. Nothing here is typed in. The figures on the landing page are whatever this run
 * produces, so the specimen and the proof tab can never describe two different sheets.
 *
 * Referred rows are placed first so a clipped specimen still shows them. Nothing else about
 * the diff is touched, and the real panel never sees this ordering.
 */
export async function buildSpecimen(): Promise<PendingProposal> {
  const shadow = await runShadow(
    store.state,
    ctx => proposeRemedy.exec({ ...SPECIMEN_INPUT }, ctx),
    { proposalId: 'specimen', versionOf: freightHost.versionOf, deltaOf: freightHost.valueDeltaOf },
  );
  const [role, target] = FREIGHT_ROLES;
  const referred = shadow.diff.groups.filter(g => isReferable(g.valueDelta, role));
  const referredKeys = new Set(referred.map(g => g.group));
  const groups = [...referred, ...shadow.diff.groups.filter(g => !referredKeys.has(g.group))];
  return {
    toolName: proposeRemedy.name,
    input: { ...SPECIMEN_INPUT },
    diff: { ...shadow.diff, groups },
    notes: shadow.notes,
    authority: { role, target: target ?? null, referred: [...referredKeys] },
    followUp: null,
    resolve: () => {},
  };
}
