/**
 * The plate at the foot of the bay, and the only way off this page.
 *
 * `edge.html` shipped with no outbound link at all — the whole document's only `href` was the
 * favicon. The demo video shows this URL, so a judge who opens it first met the estate, the
 * drawer, and then nothing: no route to the argument, to the other product on the same engine,
 * or to the source. Three destinations, named in the rack's own grammar — a legend, a scored
 * plate, and readout type for the address — rather than in the freight console's.
 *
 * The two in-repository links go to hash routes on the other entry, which is a different module
 * graph on purpose (see `vite.config.ts`), so they are plain document navigations and nothing
 * here shares state with what they open.
 */
const DESTINATIONS = [
  {
    href: '/#/proof',
    label: 'The freight console',
    note: 'The same engine on a cancelled flight. Forty-two house shipments, one proposal, one operator marking it down.',
  },
  {
    href: '/#/problem',
    label: 'The problem',
    note: 'Why a tool call is not a decision, and what this engine puts between the two.',
  },
  {
    href: 'https://github.com/harshpuri84/ladder-webmcp',
    label: 'Source',
    note: 'github.com/harshpuri84/ladder-webmcp',
    mono: true,
  },
];

export function RackFoot() {
  return (
    <footer className="fo" aria-label="Elsewhere">
      <span className="lg">Elsewhere</span>
      <ul className="fo-list">
        {DESTINATIONS.map(d => (
          <li className="fo-item" key={d.href}>
            <a className="fo-link" href={d.href}>{d.label}</a>
            <span className={d.mono ? 'fo-note rd' : 'fo-note'}>{d.note}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
