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
 * A merchandiser's Friday morning. Nothing here is a real retailer, a real SKU or a real price.
 *
 * The prices are internally true rather than plausible-looking: every new price is exactly the
 * 15% the merchandiser asked for, and the five margin deltas the tool did not decline add up to
 * the £4,180 printed at the head of the sheet. The two the operator strikes are the two the
 * store cannot afford to discount, which is the whole reason a person is standing between the
 * agent and the price file.
 */
export const CATALOGUE: MockDomain = {
  id: 'catalogue',
  name: 'Retail repricing',
  who: 'a merchandiser, the morning a promotion goes live',
  toolName: 'apply_price_change',
  prompt: 'Drop everything in the autumn range by 15% for the weekend.',
  noun: 'products',
  magnitude: '−£4,180 margin',
  rows: [
    {
      id: 'SKU-4412',
      label: 'Fern & Ash lambswool throw',
      detail: 'Autumn range · home',
      change: '£68.00 → £57.80',
      cost: '−£1,540',
      cut: true,
    },
    {
      id: 'SKU-4457',
      label: 'Hollowbrook quilted jacket',
      detail: 'Autumn range · outerwear',
      change: '£129.00 → £109.65',
      cost: '−£1,240',
      cut: true,
    },
    {
      id: 'SKU-4483',
      label: 'Marlowe corduroy shirt',
      detail: 'Autumn range · shirting',
      change: '£58.00 → £49.30',
      cost: '−£620',
    },
    {
      id: 'SKU-4490',
      label: 'Pikestone ribbed scarf',
      detail: 'Autumn range · accessories',
      change: '£24.00 → £20.40',
      cost: '−£410',
    },
    {
      id: 'SKU-4501',
      label: 'Danecroft suede boot',
      detail: 'Autumn range · footwear',
      change: '£145.00 → £123.25',
      cost: '−£370',
    },
    {
      id: 'SKU-4519',
      label: 'Orrery cashmere wrap',
      detail: 'Autumn range · knitwear',
      change: '£96.00 → £81.60',
      cost: '−£880',
      declined: 'contracted price with a partner — PRICE-CONTRACT',
    },
  ],
  payload: {
    status: 'partially_applied',
    requested: 6,
    applied: 3,
    rejected: [
      { reason: 'under a partner price contract', count: 1, ids: ['SKU-4519'] },
      { reason: 'the merchandiser removed these from the change', count: 2, ids: [] },
    ],
    replan_required: true,
  },
};

/**
 * An on-call engineer's config push. The region codes are airport-style and invented; no vendor's
 * network is described here.
 *
 * The shares are the arithmetic again: the five regions the tool did not decline come to the 38%
 * of production traffic printed at the head, and the two the engineer holds back are the two
 * largest, which is what holding a blast radius down actually looks like at three in the morning.
 */
export const EDGE: MockDomain = {
  id: 'edge',
  name: 'Edge config rollout',
  who: 'an on-call engineer, pushing a config change',
  toolName: 'roll_config',
  prompt: 'Roll the new cache rule to every edge region.',
  noun: 'regions',
  magnitude: '38% of production traffic',
  rows: [
    {
      id: 'iad1',
      label: 'Ashburn',
      detail: '210k req/s at peak',
      change: 'cache-rules v41 → v42',
      cost: '+14% traffic',
      cut: true,
    },
    {
      id: 'fra1',
      label: 'Frankfurt',
      detail: '138k req/s at peak',
      change: 'cache-rules v41 → v42',
      cost: '+9% traffic',
      cut: true,
    },
    {
      id: 'cdg1',
      label: 'Paris',
      detail: '92k req/s at peak',
      change: 'cache-rules v41 → v42',
      cost: '+6% traffic',
    },
    {
      id: 'gru1',
      label: 'São Paulo',
      detail: '74k req/s at peak',
      change: 'cache-rules v39 → v42',
      cost: '+5% traffic',
    },
    {
      id: 'sin1',
      label: 'Singapore',
      detail: '61k req/s at peak',
      change: 'cache-rules v41 → v42',
      cost: '+4% traffic',
    },
    {
      id: 'hnd1',
      label: 'Tokyo',
      detail: '88k req/s at peak',
      change: 'cache-rules v41 → v42',
      cost: '+6% traffic',
      declined: 'change freeze in effect — FREEZE-WINDOW',
    },
  ],
  payload: {
    status: 'partially_applied',
    requested: 6,
    applied: 3,
    rejected: [
      { reason: 'inside a change freeze window', count: 1, ids: ['hnd1'] },
      { reason: 'the engineer removed these from the change', count: 2, ids: [] },
    ],
    replan_required: true,
  },
};

/**
 * Exported as an array from the first domain onward, so the page maps over it and never needs
 * rewriting as the other kinds of work arrive.
 *
 * Freight leads because it is the one kind of work a reader has already seen running on the
 * proof tab; the two behind it are there to make the point that the console was a skin.
 */
export const DOMAINS: MockDomain[] = [FREIGHT, CATALOGUE, EDGE];
