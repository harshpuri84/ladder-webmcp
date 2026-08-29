import { PROMPTS, type Prompt } from './prompts';

/**
 * The sequence a judge can run themselves, on the proof tab.
 *
 * A judge watches the video, opens the live page, says one thing to the agent and stops. What
 * that first call shows is the proposal — and the proposal is the least of it. The authority
 * referral, the second signer, the agent coming back narrowed, the stale abort and the guard
 * rolling a commit back are all *downstream* of it, and none of them happen to somebody who
 * types one prompt. So the sequence is printed on the sheet.
 *
 * Every step carries what to do and what should be on screen if it worked, because a judge who
 * is not sure whether something happened assumes it did not. Each `seen` line was walked in a
 * browser and written down from what the app actually did, not from what it ought to do.
 *
 * Two rules this file exists to keep:
 *
 *  - **A step that says something to an agent says one of `PROMPTS`, verbatim.** Not a new
 *    string that reads the same. `domain/__tests__/shipped-prompts.test.ts` drives those two
 *    against the real tools; a paraphrase here would be an unheld claim, and the whole point
 *    of a walkthrough is that it cannot be wrong in front of the person checking it.
 *  - **A prompt-carrying step's `seen` is that prompt's own note.** One claim about one call,
 *    in one place, held by one test.
 */
export interface Step {
  /** What this step is, in two or three words. */
  title: string;
  /** What to do. */
  action: string;
  /** Said to the agent, when the step involves saying anything. Always an entry of `PROMPTS`. */
  prompt?: Prompt;
  /** What is on screen if it worked. Never a promise about the agent — only about this page. */
  seen: string;
  /**
   * Set on the two steps that drive a control the console already labels a deliberate
   * demonstration. Repeated here rather than assumed: a judge reading a step out of order must
   * not come away thinking the buggy tool is a real defect or that Marta is a second person
   * signed in.
   */
  demonstration?: string;
}

export const STEPS: Step[] = [
  {
    title: 'Propose',
    action:
      'Say this to an agent driving this page. The call proposes; it applies nothing. Everything '
      + 'it wants arrives here as a proof first.',
    prompt: PROMPTS[0],
    seen: PROMPTS[0].note,
  },
  {
    title: 'Cut it down',
    action: 'Untick three rows in the panel’s list.',
    seen:
      'Every figure moves with you. The hero count falls to 20 with the 27 still struck through '
      + 'beside it, and the caption under the bar reads “20 of 42 shipments in the register · '
      + 'struck down from 27”. The stamp changes grade — “OK to run” becomes “OK with changes” — '
      + 'and its label goes from “Apply 23 of 23” to “Apply 20 of 23”, counted against the 23 you '
      + 'may authorise rather than the 27 on the sheet. The four referred rows keep their own line '
      + 'underneath: “and refer 4 shipments”.',
  },
  {
    title: 'Apply',
    action: 'Press the stamp, and read the receipt that comes back.',
    seen:
      'requested 27 · applied 20 · referred 4, above the gateway operator’s EUR 250 spend '
      + 'authority · refused 3, the operator removed these from the change · replan required yes. '
      + 'Twenty and four and three is twenty-seven: the receipt accounts for every row it was '
      + 'asked about. The register behind it now carries a remedy against 20 shipments.',
  },
  {
    title: 'Refer, and sign as the second person',
    action:
      'The four referred shipments are queued in the Spend authority strip above the register, '
      + 'and their button reads “Waiting on the duty manager” — it is disabled, because you are '
      + 'not one. Press Duty manager in that strip, then Review as duty manager.',
    seen:
      'The same tool runs again over only those four ids, and the panel says so above the '
      + 'figures: “Follows the … run — asks only about 4 rows sent to a duty manager”, '
      + 'with the clock time of your first run where the dots are. It is stamped “OK to run” '
      + 'over “Apply 4 of 4”, and the hero carries the +€1,331 that was over '
      + 'the first role’s limit. Sign it and the receipt reads requested 4 · applied 4 · refused 0 '
      + '· replan required no. The referral queue empties.',
  },
  {
    title: 'Watch a change land underneath you',
    action:
      'Say the first prompt again. While the panel is open, type one of the shipment ids it lists '
      + 'into the register’s filter box — the register stays live behind the panel, which is the '
      + 'point — then press “Marta edits this” on that row and stamp the proposal.',
    seen:
      'The row’s version number goes up by one and its revenue moves €25 while you watch. Then a '
      + 'receipt stamped “Superseded”, titled “Marta got there first”: applied 0, every row refused '
      + 'with “a record changed after the preview; nothing was applied”. Not only her row — the '
      + 'whole commit aborted rather than land against a world that had moved.',
    demonstration:
      'Marta is a button on the register, not a second person signed in. The console labels her as '
      + 'a simulation of the other operator on the shift.',
  },
  {
    title: 'Make the tool misbehave',
    action:
      'Tick “Simulate a buggy tool” under the register, say the first prompt again, and stamp the '
      + 'proposal. Untick it afterwards.',
    seen:
      'A receipt stamped “Blocked”, titled “Ladder blocked this”: applied 0, and the reason names '
      + 'the exact field the tool reached for outside what you approved — an SLA tier on one of the '
      + 'shipments in the run. '
      + 'The SLA column in the register is untouched — the whole commit rolled back, not just the '
      + 'write that went off-script.',
    demonstration:
      'The toggle exists to give the guard something to stop, and says so beside itself. It is not '
      + 'a real defect and nothing else on this page depends on it.',
  },
  {
    title: 'Ask it to look, not to change',
    action:
      'A read takes a different path through the same guard: there is nothing to approve, so no '
      + 'proof is raised at all. Say this.',
    prompt: PROMPTS[1],
    seen: PROMPTS[1].note,
  },
];
