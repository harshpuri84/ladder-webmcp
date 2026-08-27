/**
 * The words the interface uses for the three remedy ids. The domain decides which remedy a
 * shipment gets and which rule blocks the rest; it deliberately says so in ids and in one
 * sentence per rule. Turning an id into the phrase an operator reads is an interface job, so
 * it happens here and only here — nothing in src/domain imports this file.
 *
 * Two lengths, because two places need it: the full phrase on a proof line, where there is
 * room to say what actually happens to the freight, and a short one for a tally or a register
 * cell, where there is not.
 */
import type { RemedyId } from '../domain/types';

interface RemedyWords {
  /** The proof line: what happens to this shipment, in the words an operator would use. */
  full: string;
  /** A tally row or a register cell. */
  short: string;
}

const WORDS: Record<RemedyId, RemedyWords> = {
  rebook: {
    full: 'Same carrier, tomorrow morning',
    short: 'rebook',
  },
  competitor: {
    full: "Competitor's freighter, tonight",
    short: 'freighter',
  },
  truck: {
    full: 'Truck to another gateway, fly from there',
    short: 'truck-and-fly',
  },
};

export const remedyFull = (r: RemedyId): string => WORDS[r]?.full ?? r;
export const remedyShort = (r: RemedyId): string => WORDS[r]?.short ?? r;

const euro = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * A cost of zero is the free same-carrier rebook, which is the whole reason most rows take it.
 * "EUR 0" makes the reader do the arithmetic to find that out; the word does not.
 */
export const remedyCostWords = (cost: number): string => (cost === 0 ? 'free' : euro.format(cost));

export const money = (n: number): string => euro.format(n);
