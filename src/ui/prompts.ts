/**
 * What to say to an agent driving the freight console, shown on the proof tab.
 *
 * Its own module rather than a constant beside the component, so the wording can be held against
 * the real tool without a test importing a React component to reach it — see
 * `domain/__tests__/shipped-prompts.test.ts`, which asserts that each of these produces the
 * outcome its note claims. The edge console keeps the same arrangement for the same reason
 * (`edge/ui/prompts.ts`); the two worlds share the shape of the problem and not a line of code.
 */
export interface Prompt {
  /** Said to the agent verbatim. Written in the tools' own vocabulary — remedy, shipment, consol,
   *  the consol id printed on the register — so it lands on `propose_remedy` or
   *  `search_shipments` rather than on a guess. */
  text: string;
  /** What comes back, in one line. A prompt with no expectation attached is a list; a prompt with
   *  one is a demonstration. */
  note: string;
}

export const PROMPTS: Prompt[] = [
  {
    text: 'Propose a remedy for every shipment on CONSOL-A.',
    note: 'Twenty-seven of the forty-two ride that consol. Four cost more than a gateway operator may authorise, so they are set apart before you look and cannot be marked by hand; the panel opens at twenty-three marked.',
  },
  {
    text: 'Show me the shipments carrying lithium-ion batteries.',
    note: 'Two of the forty-two. The register narrows to those two, labelled as set by the agent and cleared by you in one click. Nothing is changed and nothing leaves the register. The count above the table goes on reading 2 of 42.',
  },
];
