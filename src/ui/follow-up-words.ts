import type { FollowUp, FollowUpPart } from '../webmcp/adapter';

/**
 * The freight console's words for one observed fact: this call names only records an earlier
 * call was refused on.
 *
 * Everything here is composed from `FollowUp`, and `FollowUp` is composed from two tool calls
 * that actually arrived. Nothing in this file may describe what an agent thought, understood,
 * decided or intended — none of that is observable from a tool call, and a sentence claiming it
 * would be the one thing this feature must be incapable of saying. The sentences below say what
 * the earlier call did with those records and what this one asks about, and stop there.
 *
 * The edge console gets its own words for the same fact when it gets this; it does not borrow
 * these, for the reason DESIGN.md gives for keeping the two worlds apart.
 */

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The clock time of the earlier run, which is how the run log already identifies a line. */
export function followUpTime(f: FollowUp): string {
  return timeFmt.format(f.at);
}

const rows = (n: number) => (n === 1 ? '1 row' : `${n} rows`);

/** `awaiting` arrives as the host's role label ("duty manager"), sometimes already carrying its
 *  own article. Both read as a name here, so the article is added only where it is missing. */
const withArticle = (s: string) => (/^an? /i.test(s) ? s : `a ${s}`);

/**
 * One clause per kind of refusal, because an agent asking again about a row the operator struck
 * out and one asking again about a row a second person is holding are not the same event, and a
 * single word for both would flatten the distinction the payload works to draw.
 */
function clause(p: FollowUpPart): string {
  switch (p.kind) {
    case 'removed':
      return `${rows(p.count)} the operator struck out`;
    case 'referred':
      return `${rows(p.count)} sent to ${withArticle(p.awaiting ?? 'second approver')}`;
    case 'blocked':
      return `${rows(p.count)} the tool itself left alone`;
  }
}

/** "3 rows the operator struck out and 4 rows sent to a duty manager" */
export function followUpTail(f: FollowUp): string {
  const parts = f.parts.map(clause);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
