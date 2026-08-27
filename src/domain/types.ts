export type RemedyId = 'rebook' | 'competitor' | 'truck';
export type SlaTier = 'premium' | 'standard' | 'basic';
export type ScreeningStatus = 'cleared' | 'pending';
export type CustomsStatus = 'released' | 'held';

/** Named the way a linter names its rules: a stable id plus the sentence a human reads. */
export interface RemedyRule {
  id: string;
  description: string;
}

/** A remedy that would otherwise be a candidate but is blocked for a specific shipment. */
export interface BlockedAlternative {
  remedy: RemedyId;
  ruleId: string;
  rule: string;
}

export interface Shipment {
  id: string;              // "HAWB-70001"
  mawb: string;             // the one disrupted master air waybill every row shares
  consol: string;           // "CONSOL-A" | "CONSOL-B" — which of the two consols this rides on
  customer: string;
  slaTier: SlaTier;
  promisedDelivery: string; // "2026-09-14"
  revenueEur: number;
  weightKg: number;
  lithiumBattery: boolean;
  activeTempControl: boolean;
  tempEnduranceHours: number; // meaningful only when activeTempControl is true; 0 otherwise
  pharmaQualifiedLane: boolean;
  oversizeMainDeckOnly: boolean;
  screeningStatus: ScreeningStatus;
  customsStatus: CustomsStatus;
  // Remedy state — null/0/[] until propose_remedy assigns one. Every field here is primitive
  // or, for blockedAlternatives, replaced wholesale on write — never mutated in place — so the
  // two-level-deep recorder in core/recorder.ts sees every change.
  remedy: RemedyId | null;
  remedyCost: number;
  recoveredHours: number;
  blockedAlternatives: BlockedAlternative[];
  version: number;
}

export interface AppState {
  shipments: Record<string, Shipment>;
}
