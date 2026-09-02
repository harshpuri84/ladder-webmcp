/**
 * What to say to an agent driving this page, shown on the operating plate.
 *
 * Its own module rather than a constant beside the component, so the wording can be held against
 * the real tool without a test importing a React component to reach it — see
 * `__tests__/shipped-prompts.test.ts`, which asserts that each of these produces the outcome its
 * note claims.
 */
export interface Prompt {
  /** Said to the agent verbatim. Written in the tool's own vocabulary — stage, release, site,
   *  region — so it lands on `roll_config` rather than on a guess. */
  text: string;
  /** What comes back, in one line. A prompt with no expectation attached is a list; a prompt with
   *  one is a demonstration. */
  note: string;
}

export const PROMPTS: Prompt[] = [
  {
    text: 'Stage the candidate release at every site.',
    note: 'The whole estate in one call. Sites above your exposure authority are referred to the traffic lead, never quietly applied.',
  },
  {
    text: 'Stage the candidate release in eu-north only.',
    note: 'Four sites, small enough to read whole, and two of them are somebody else’s call.',
  },
];
