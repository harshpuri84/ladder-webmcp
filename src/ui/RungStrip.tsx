import { useEffect, useState } from 'react';
import { activePolicy, describePolicy, onDraft, onPolicyChange, ratify, revoke } from '../webmcp/adapter';
import type { Policy } from '../core/policy';
import { NEVER_ELIGIBLE } from '../domain/policy-eligibility';

/**
 * The four write tools, in registration order. Read tools (search_shipments, get_shipment)
 * never carry a rung — nothing about them is ever applied without review because nothing
 * about them writes anything — so they have no chip here.
 */
const WRITE_TOOLS = ['update_shipments', 'reprice_shipments', 'cancel_shipments', 'notify_customers'];

const DAY_MS = 86_400_000;
const DEFAULT_EXPIRY_DAYS = 7;

function todayPlusDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Builds an unratified Policy the same shape draftPolicy() would hand back, so the up-front
 * door and the drafted-from-history door ratify through the exact same object — the point of
 * having two doors at all.
 */
function draftFromForm(tool: string, maxRecords: number, maxValue: number, expiresOn: string): Policy {
  return {
    id: `pol-${tool}-manual-${Date.now()}`,
    tool,
    maxRecords,
    maxValue,
    expiresAt: new Date(`${expiresOn}T23:59:59.999Z`).toISOString(),
    draftedFrom: 'operator',
    ratified: false,
  };
}

interface RuleFormProps {
  onSubmit(p: Policy): void;
  onCancel(): void;
}

/** The up-front door: the same policy shape a draft card offers, opened before the agent has done anything. */
function RuleForm({ onSubmit, onCancel }: RuleFormProps) {
  const eligible = WRITE_TOOLS.filter(t => !NEVER_ELIGIBLE.includes(t));
  const [tool, setTool] = useState(eligible[0] ?? '');
  const [maxRecords, setMaxRecords] = useState(20);
  const [maxValue, setMaxValue] = useState(500);
  const [expiresOn, setExpiresOn] = useState(() => todayPlusDays(DEFAULT_EXPIRY_DAYS));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool) return;
    onSubmit(draftFromForm(tool, maxRecords, maxValue, expiresOn));
  };

  return (
    <form className="rs-form" onSubmit={submit}>
      <label className="rs-field">
        Tool
        <select value={tool} onChange={e => setTool(e.target.value)}>
          {eligible.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="rs-field">
        Up to records
        <input
          type="number" min={1} value={maxRecords}
          onChange={e => setMaxRecords(Math.max(1, Number(e.target.value)))}
        />
      </label>
      <label className="rs-field">
        Up to EUR
        <input
          type="number" min={0} value={maxValue}
          onChange={e => setMaxValue(Math.max(0, Number(e.target.value)))}
        />
      </label>
      <label className="rs-field">
        Expires
        <input type="date" value={expiresOn} onChange={e => setExpiresOn(e.target.value)} />
      </label>
      <div className="rs-form-actions">
        <button className="rs-ratify" type="submit" disabled={!tool}>Ratify</button>
        <button className="rs-form-cancel" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** One chip's contents: rung 0, rung 1 with the rule in plain words, or permanently ineligible. */
function ChipState({ tool }: { tool: string }) {
  if (NEVER_ELIGIBLE.includes(tool)) {
    return <span className="rs-chip-state rs-chip-state--never">never automatic — always reviewed</span>;
  }
  const pol = activePolicy(tool);
  if (pol?.ratified) {
    return <span className="rs-chip-state rs-chip-state--rung1">standing rule — {describePolicy(pol)}</span>;
  }
  return <span className="rs-chip-state">reviewed every time</span>;
}

export function RungStrip() {
  // No policy state is read directly out of the adapter's map into React state — activePolicy()
  // is read fresh on every render. This counter is never read itself; bumping it is only ever
  // used to force that render whenever ratify() fires, from either door.
  const [, setTick] = useState(0);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => onDraft(setDraft), []);
  useEffect(() => onPolicyChange(() => setTick(t => t + 1)), []);

  const ratifyDraft = () => ratify(draft!);
  const ratifyForm = (p: Policy) => {
    ratify(p);
    setFormOpen(false);
  };

  return (
    <section className="rs" aria-label="Standing rules">
      <p className="rs-heading">Standing rules</p>
      <div className="rs-chips">
        {WRITE_TOOLS.map(tool => {
          const pol = activePolicy(tool);
          const never = NEVER_ELIGIBLE.includes(tool);
          const rung1 = Boolean(pol?.ratified);
          return (
            <div
              key={tool}
              className={`rs-chip${rung1 ? ' rs-chip--rung1' : ''}${never ? ' rs-chip--never' : ''}`}
            >
              <span className="rs-chip-tool mono">{tool}</span>
              <ChipState tool={tool} />
              {/* F5: the only exits from a ratified rule used to be waiting for expiry or
                  reloading the page. Revoking goes through the same path expiry already uses
                  (see revoke() in webmcp/adapter.ts) — the tool goes back to its base
                  description and the next call is reviewed again. */}
              {rung1 && (
                <button
                  className="rs-revoke"
                  type="button"
                  onClick={() => revoke(tool)}
                  aria-label={`Revoke the standing rule for ${tool}`}
                >
                  Revoke
                </button>
              )}
            </div>
          );
        })}
        <button
          className="rs-add"
          type="button"
          onClick={() => setFormOpen(v => !v)}
          aria-expanded={formOpen}
        >
          {formOpen ? 'Cancel' : 'Add a standing rule'}
        </button>
      </div>

      {formOpen && <RuleForm onSubmit={ratifyForm} onCancel={() => setFormOpen(false)} />}

      {draft && (
        <div className="rs-draft">
          <p className="rs-draft-text">
            <span className="mono">{draft.tool}</span> has cleared three clean approvals in a
            row. Ladder can now handle {describePolicy(draft)} without asking first.
          </p>
          <div className="rs-form-actions">
            <button className="rs-ratify" type="button" onClick={ratifyDraft}>Ratify</button>
            <button className="rs-form-cancel" type="button" onClick={() => setDraft(null)}>Dismiss</button>
          </div>
        </div>
      )}
    </section>
  );
}
