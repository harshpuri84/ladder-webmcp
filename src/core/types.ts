export interface WriteRecord {
  entity: string; id: string; field: string;
  before: unknown; after: unknown; group: string;
}

export interface ActionRecord {
  actionId: string; kind: string;
  payload: Record<string, unknown>;
  reversible: false;
}

/** A domain-supplied reason a row was left alone. Core never authors these. */
export interface Note { id: string; reason: string; }

export interface RecorderHooks {
  onWrite(w: WriteRecord): void;
  guard?(k: { entity: string; id: string; field: string }): 'allow' | 'skip';
}

export const groupKey = (entity: string, id: string) => `${entity}:${id}`;
export const fieldKey = (entity: string, id: string, field: string) => `${entity}:${id}:${field}`;
