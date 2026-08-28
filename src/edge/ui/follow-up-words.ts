import type { FollowUp, FollowUpPart } from '../../webmcp/adapter';

/**
 * The edge console's words for one observed fact: this call names only sites an earlier call was
 * refused on. The same fact the freight console states, said in this product's own trade words —
 * sites, latches, rules — and never by importing the other one's, for the reason DESIGN.md gives
 * for keeping the two worlds apart.
 *
 * Nothing here may describe what an agent thought, understood or intended: a tool call carries
 * none of that, and a page asserting it would be claiming a loop closed on evidence it does not
 * have. These sentences say what the earlier call did with these sites and what this one asks
 * about, and stop.
 */

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export function followUpTime(f: FollowUp): string {
  return timeFmt.format(f.at);
}

const sites = (n: number) => (n === 1 ? '1 site' : `${n} sites`);

/** `awaiting` is the host's role label ("traffic lead"), sometimes already carrying its article. */
const withArticle = (s: string) => (/^an? /i.test(s) ? s : `a ${s}`);

function clause(p: FollowUpPart): string {
  switch (p.kind) {
    case 'removed':
      return `${sites(p.count)} the operator unlatched`;
    case 'referred':
      return `${sites(p.count)} held by ${withArticle(p.awaiting ?? 'second approver')}`;
    case 'blocked':
      return `${sites(p.count)} a rule closed`;
  }
}

/** "2 sites the operator unlatched and 1 site held by a traffic lead" */
export function followUpTail(f: FollowUp): string {
  const parts = f.parts.map(clause);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
