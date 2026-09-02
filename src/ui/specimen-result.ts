import { runCommit } from '../core/commit';
import { buildWriteSet } from '../core/writeset';
import { draftPolicy } from '../core/policy';
import type { Note } from '../core/types';
import { store } from '../domain/store';
import { proposeRemedy } from '../domain/tools';
import { NEVER_ELIGIBLE } from '../domain/policy-eligibility';
import type { AppState } from '../domain/types';
import { authorityVocabulary } from '../webmcp/authority';
import { describePolicy } from '../webmcp/adapter';
import type { PendingProposal } from '../webmcp/adapter';
import type { ToolPayload } from '../webmcp/result';
import { SPECIMEN_INPUT } from './specimen';

/**
 * What the agent gets back after the operator stamps the specimen sheet as it stands: every row
 * she may sign for marked, the referred rows left to the duty manager.
 *
 * Read, not typed. The stamp runs the same commit the live panel runs, `buildWriteSet` and
 * `runCommit` from core, against a structured copy of the register, so the live register is
 * never touched and every figure below is whatever that commit produced. The ledger around the
 * commit is assembled the way `execute()` in webmcp/adapter.ts assembles it (`requested`
 * counts the domain skips, referred rows sit in `rejected` as pending and are subtracted from
 * `replan_required`, a bucket with nothing in it is not printed), because that code is only
 * reachable through a live tool call against the live register. If the two ever disagree the
 * build is right and this is what changes.
 */
function rejectedFrom(notes: Note[]) {
  const byReason = new Map<string, string[]>();
  for (const n of notes) {
    const a = byReason.get(n.reason) ?? []; a.push(n.id); byReason.set(n.reason, a);
  }
  return [...byReason].map(([reason, ids]) => ({ reason, ids, count: ids.length }));
}

export async function specimenResult(p: PendingProposal): Promise<ToolPayload> {
  const { diff, notes, authority } = p;
  const referredKeys = new Set(authority.referred);
  const referredGroups = diff.groups.filter(g => referredKeys.has(g.group));
  const approvedGroups = diff.groups.map(g => g.group).filter(g => !referredKeys.has(g));
  const approvedActions = diff.actions.map(a => a.actionId);

  const copy = structuredClone(store.state) as AppState;
  const ws = buildWriteSet(diff, approvedGroups, approvedActions);
  const out = await runCommit(
    copy,
    ctx => proposeRemedy.exec({ ...SPECIMEN_INPUT }, ctx),
    ws,
    {
      versionOf: (_entity, id) => copy.shipments[id]?.version ?? -1,
      bumpVersion: (_entity, id) => { const s = copy.shipments[id]; if (s) s.version += 1; },
    },
  );

  const diffRequested = diff.totals.records + diff.actions.length;
  const requested = diffRequested + notes.length;
  const appliedRowKeys = new Set(out.applied.map(w => `${w.entity}:${w.id}`));
  const appliedRows = appliedRowKeys.size;
  const committed = out.status === 'applied' || out.status === 'partially_applied';
  const narrowedOut = committed ? diff.totals.records - appliedRows : 0;
  const droppedActions = committed ? out.dropped.length : 0;
  const appliedTotal = appliedRows + out.released.length;
  const referredCount = committed ? referredGroups.length : 0;
  const removedByOperator = narrowedOut - referredCount;
  const referredIds = referredGroups.map(g => g.id);
  const removedIds = committed
    ? diff.groups
        .filter(g => !appliedRowKeys.has(g.group) && !referredKeys.has(g.group))
        .map(g => g.id)
    : [];
  const { role, target } = authority;
  const awaiting = target ? target.label.toLowerCase() : 'a second approver';
  const v = authorityVocabulary();

  const rejected = out.error !== undefined ? [] : [
    ...rejectedFrom(notes),
    ...(referredCount > 0 ? [{
      count: referredCount,
      reason: `above the ${role.label.toLowerCase()}'s ${v.amount(role.limit)} ${v.bound}, referred to a ${awaiting}`,
      ids: referredIds,
      pending: awaiting,
    }] : []),
    ...(removedByOperator > 0 ? [{ count: removedByOperator, reason: 'the operator removed these from the change', ids: removedIds }] : []),
    ...(droppedActions > 0 ? [{ count: droppedActions, reason: 'the operator did not approve these messages', ids: out.dropped }] : []),
  ].filter(r => r.count > 0);
  const rejectedTotal = rejected.reduce((n, r) => n + r.count, 0);

  const status =
    out.status !== 'applied' ? out.status :
    rejectedTotal === 0 ? 'applied' :
    appliedTotal === 0 ? 'denied' :
    'partially_applied';

  // A rule is offered only off a clean run, and off a history of them; one specimen run is
  // put through the same gate rather than assumed to fail it.
  const draft = status === 'applied'
    ? draftPolicy(p.toolName, [{
        tool: p.toolName, proposalId: diff.proposalId, proposed: requested,
        approved: appliedTotal, valueDelta: diff.totals.valueDelta,
      }], new Date(), NEVER_ELIGIBLE)
    : null;

  return {
    status,
    requested: out.error !== undefined ? appliedTotal : requested,
    applied: appliedTotal,
    rejected,
    actions_released: out.released.length,
    actions_dropped: out.dropped.length,
    replan_required: rejectedTotal - referredCount > 0 || out.error !== undefined,
    ...(referredCount > 0 ? { referred: { count: referredCount, ids: referredIds, awaiting } } : {}),
    rule_offered: draft ? describePolicy(draft) : null,
    ...(out.error !== undefined ? { error: `the tool failed during commit: ${out.error}` } : {}),
  };
}

/**
 * The payload as a block: one key a line, objects opened out, and every id list kept on one
 * line the way the problem page prints its sample. `JSON.stringify` with an indent would put
 * every id on a line of its own and turn four referred rows into a column.
 */
function printValue(v: unknown, depth: number): string {
  const pad = '  '.repeat(depth);
  if (Array.isArray(v)) {
    if (v.every(x => typeof x !== 'object' || x === null)) {
      return `[${v.map(x => JSON.stringify(x)).join(', ')}]`;
    }
    return `[\n${v.map(x => `${pad}  ${printValue(x, depth + 1)}`).join(',\n')}\n${pad}]`;
  }
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${pad}  ${JSON.stringify(k)}: ${printValue(x, depth + 1)}`);
    return `{\n${entries.join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(v);
}

export function printPayload(p: ToolPayload): string {
  return printValue(p, 0);
}
