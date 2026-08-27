import type { MockDomain } from './types';

/**
 * Drawn sequences, one per kind of work. None of these is wired to anything.
 *
 * The freight one borrows the console's vocabulary — house waybill ids, two consolidations, the
 * three SLA tiers, the three remedies — so a reader coming from the proof tab recognises it as
 * the same world. Every customer name is invented. The figures are authored to agree with each
 * other: the magnitude is the sum of the rows the tool did not decline, so when the operator
 * strikes two of them the money line can be restated off the rows rather than written down a
 * second place where it could drift.
 */
export const FREIGHT: MockDomain = {
  id: 'freight',
  name: 'Air freight recovery',
  who: 'a gateway operator, ninety minutes from cutoff',
  toolName: 'propose_remedy',
  prompt: 'The Chicago flight is cancelled. Find the cheapest remedy that still meets each customer’s promise.',
  noun: 'shipments',
  magnitude: '+€1,240 recovery cost',
  rows: [
    {
      id: 'HAWB-70004',
      label: 'Ashgrove Pharma',
      detail: 'CONSOL-A · premium',
      change: 'rebook → competitor freighter tonight',
      cost: '+€480',
    },
    {
      id: 'HAWB-70019',
      label: 'Solace Robotics',
      detail: 'CONSOL-A · premium',
      change: 'rebook → competitor freighter tonight',
      cost: '+€430',
    },
    {
      id: 'HAWB-70023',
      label: 'Brightwell Toys',
      detail: 'CONSOL-B · basic',
      change: 'rebook → competitor freighter tonight',
      cost: '+€190',
      cut: true,
    },
    {
      id: 'HAWB-70031',
      label: 'Loomis Carpets',
      detail: 'CONSOL-B · basic',
      change: 'rebook → truck to Amsterdam, fly tomorrow',
      cost: '+€140',
      cut: true,
    },
    {
      id: 'HAWB-70036',
      label: 'Perch Coffee Traders',
      detail: 'CONSOL-A · standard',
      change: 'rebook → same carrier, tomorrow morning',
      cost: '+€0',
    },
    {
      id: 'HAWB-70037',
      label: 'Marrow Biotech',
      detail: 'CONSOL-B · premium',
      change: 'rebook → competitor freighter tonight',
      cost: '+€480',
      declined: 'customs hold open — LADDER-CUSTOMS',
    },
  ],
  payload: {
    status: 'partially_applied',
    requested: 6,
    applied: 3,
    rejected: [
      { reason: 'customs hold open on this house waybill', count: 1, ids: ['HAWB-70037'] },
      { reason: 'the operator removed these from the change', count: 2, ids: [] },
    ],
    replan_required: true,
  },
};

/**
 * Exported as an array from the first domain onward, so the page maps over it and never needs
 * rewriting as the other kinds of work arrive.
 */
export const DOMAINS: MockDomain[] = [FREIGHT];
