/**
 * The correction marks a press proof is marked up with, drawn rather than borrowed.
 *
 * Every state in this interface has to survive colour being removed — the operator this is
 * built for has red-green colour vision deficiency, so hue can only ever confirm something a
 * second signal already said. Printers solved that problem before colour reproduced reliably:
 * they standardised a vocabulary of *shapes*. These are those shapes.
 *
 * One stroke weight, one cap style, one 16-unit box, `currentColor` throughout, so a mark
 * inherits the weight of the line it sits beside instead of announcing itself.
 */

import type { ReactNode } from 'react';

export type MarkName =
  | 'insert'
  | 'dele'
  | 'stet'
  | 'dagger'
  | 'query'
  | 'registration';

/**
 * `insert`  — the caret. This correction goes in.
 * `dele`    — the deletion loop. This comes out.
 * `stet`    — dots beneath a struck line. Let it stand: ignore the correction above.
 * `dagger`  — the reference mark. Points at something set apart from the main run.
 * `query`   — the author's query, written in the margin as "Qy?". The proofreader cannot
 *             settle this one and passes it to whoever can. That is exactly a referral, so it
 *             is the mark a referred row carries, and it is a different shape from every other
 *             mark here rather than the same shape in another colour.
 * `regist.` — the registration target, printed outside the trim so plates line up.
 */
const PATHS: Record<MarkName, ReactNode> = {
  insert: (
    <>
      <path d="M3.25 10.5 8 5.25 12.75 10.5" />
      <path d="M8 5.25V13.5" />
    </>
  ),
  dele: (
    <>
      <path d="M2.5 8.75h8.25" />
      <path d="M10.75 8.75c2 0 2.75-1.6 1.9-3.1-.7-1.25-2.2-1.6-3.4-1.15" />
    </>
  ),
  stet: (
    <>
      <path d="M2.75 6.25h10.5" />
      <path d="M4.5 10.75h.01M8 10.75h.01M11.5 10.75h.01" />
    </>
  ),
  dagger: (
    <>
      <path d="M8 2.25v11.5" />
      <path d="M4.25 5.5h7.5" />
    </>
  ),
  query: (
    <>
      <path d="M5.4 5.6a2.65 2.65 0 1 1 3.35 2.55c-.62.2-.9.66-.9 1.3v.65" />
      <path d="M7.85 13.1h.3" />
    </>
  ),
  registration: (
    <>
      <circle cx="8" cy="8" r="4.25" />
      <path d="M8 0.75v4.5M8 10.75v4.5M0.75 8h4.5M10.75 8h4.5" />
    </>
  ),
};

export interface ProofMarkProps {
  name: MarkName;
  /** Rendered box in px. The stroke stays optically even because the viewBox scales with it. */
  size?: number;
  className?: string;
  /** Marks are always redundant with a word nearby, so they are hidden from assistive tech. */
  title?: string;
}

export function ProofMark({ name, size = 14, className, title }: ProofMarkProps) {
  return (
    <svg
      className={className ? `pm ${className}` : 'pm'}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/** The four corner targets that make a sheet read as a sheet rather than as a card. */
export function RegistrationCorners() {
  return (
    <div className="reg" aria-hidden="true">
      <ProofMark name="registration" size={11} className="reg-tl" />
      <ProofMark name="registration" size={11} className="reg-tr" />
    </div>
  );
}
