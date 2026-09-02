// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { LandingHero, WEBMCP_ABSENT } from '../LandingHero';
import { buildSpecimen } from '../specimen';
import { specimenResult } from '../specimen-result';
import proofPageSource from '../pages/ProofPage.tsx?raw';

const flat = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * The landing page's first viewport: the name, the claim, and a real proof sheet fed by the
 * same tool run the proof tab would make. The figures are asserted against the measured run
 * (27 matched, 23 for the operator, 4 referred) so a fixture change shows up here first.
 */
describe('LandingHero', () => {
  afterEach(cleanup);

  it('sets the name and the claim above the specimen', async () => {
    const { container } = render(<LandingHero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent)
      .toContain('Agents can act.');
    // Two sentences on two lines, the second a block of its own; one claim to a reader.
    expect(flat(container.querySelector('.hero-claim-lead')!)).toBe('Agents can act. Humans stay in control.');
    expect(screen.getByText('Every agent write comes here as a proof before it lands.')).toBeTruthy();
    // The sheet carries no "Specimen" tag; the figure's own label says what it is.
    await waitFor(() => expect(container.querySelector('.pp--specimen')).toBeTruthy());
    expect(container.querySelector('.hero-specimen')!.getAttribute('aria-label')).toContain('as the operator sees it');
    expect(screen.queryByText('Specimen')).toBeNull();
  });

  it('renders the CONSOL-A proof sheet read-only, with its count, its struck ask and its stamp', async () => {
    const { container } = render(<LandingHero />);
    await waitFor(() => expect(container.querySelector('.pp--specimen')).toBeTruthy());
    const sheet = container.querySelector('.pp--specimen')!;

    expect(sheet.hasAttribute('inert')).toBe(true);
    expect(sheet.getAttribute('role')).toBeNull();
    expect(container.querySelector('.pp-scrim')).toBeNull();
    expect(document.body.classList.contains('pp-active')).toBe(false);

    expect(flat(sheet.querySelector('.br-count')!)).toBe('23');
    expect(flat(sheet.querySelector('.br-count-was')!)).toBe('27');
    expect(flat(sheet.querySelector('.pp-refer-line')!)).toContain('4 shipments over your €250 limit');
    expect(flat(sheet.querySelector('.pp-stamp')!)).toContain('Apply 23');
    expect(flat(sheet.querySelector('.pp-stamp')!)).toContain('Refer 4 to duty manager');
  });

  it('ends on a row boundary: the referred rows first, then a count of what is below', async () => {
    const { container } = render(<LandingHero />);
    await waitFor(() => expect(container.querySelector('.pp--specimen')).toBeTruthy());
    const rows = [...container.querySelectorAll('.pp--specimen .dg')];
    expect(rows.length).toBe(1);
    expect(rows.every(r => r.classList.contains('dg--referred'))).toBe(true);
    expect(flat(container.querySelector('.pp-more')!)).toBe('26 more rows on the sheet. The whole of it is on the proof tab.');
  });

  it('prints the path from prompt to proof off the same run, with the registered tool names', async () => {
    const { container } = render(<LandingHero />);
    await waitFor(() => expect(container.querySelector('.hero-path')).toBeTruthy());
    // One kind of thing in the first column: a verb on every row. The registered tool name,
    // where a stage has one, opens the description in mono.
    const names = [...container.querySelectorAll('.hero-stage-name')].map(flat);
    expect(names).toEqual(['Search', 'Inspect', 'Propose', 'Refer', 'Proof']);
    const tools = [...container.querySelectorAll('.hero-stage-tool')].map(flat);
    expect(tools).toEqual(['search_shipments', 'get_shipment', 'propose_remedy']);
    const whats = [...container.querySelectorAll('.hero-stage-what')].map(flat);
    expect(whats[0]).toContain('42 house shipments');
    expect(whats[2]).toContain('27 shipments matched');
    expect(whats[3]).toContain('4 cost more than a gateway operator may sign');
    expect(whats[4]).toContain('She marks 23');
  });
  /**
   * The runtime line, now the fold's eyebrow. jsdom hands the page no `modelContext`, so this is
   * the absent state: it must say what the proof page's banner says, in the same words, and not
   * claim to be active. The active state is held by LandingHero-webmcp.test.tsx.
   */
  it('says the agent half needs WebMCP when there is no runtime, in the proof page\'s own words', async () => {
    const { container } = render(<LandingHero />);
    await waitFor(() => expect(container.querySelector('.hero-webmcp')).toBeTruthy());
    const line = flat(container.querySelector('.hero-webmcp')!);
    expect(line).toBe(WEBMCP_ABSENT);
    expect(line).not.toContain('active');
    expect(proofPageSource).toContain(WEBMCP_ABSENT);
    // It leads the fold, above the claim: the first thing in the reading column.
    const text = container.querySelector('.hero-text')!;
    expect(text.firstElementChild!.classList.contains('hero-webmcp')).toBe(true);
    // And the path it used to head still names itself, below the fold.
    const path = container.querySelector('.hero-path')!;
    expect(path.firstElementChild!.textContent).toBe('From prompt to proof');
  });

  it('names the commit boundary above the two stamps', async () => {
    const { container } = render(<LandingHero />);
    await waitFor(() => expect(container.querySelector('.pp--specimen')).toBeTruthy());
    const foot = container.querySelector('.pp-foot')!;
    const kids = [...foot.children];
    const line = kids.findIndex(k => k.classList.contains('pp-foot-nothing'));
    expect(flat(kids[line])).toBe('Nothing changes until you stamp it.');
    expect(kids.findIndex(k => k.classList.contains('pp-refuse'))).toBeGreaterThan(line);
    expect(kids.findIndex(k => k.classList.contains('pp-stamp'))).toBeGreaterThan(line);
    // Refuse before the stamp, in the order the desk has them.
    expect(kids.findIndex(k => k.classList.contains('pp-refuse')))
      .toBeLessThan(kids.findIndex(k => k.classList.contains('pp-stamp')));
  });

  /**
   * The loop closing on the page: what the tool returns to the agent for this exact run, read
   * off the same specimen stamped as it stands. The block is asserted against a second call to
   * the same reader, and the reader against the run itself: applied is what the operator may
   * sign, referred is what she may not, and applied plus every rejected count is requested.
   */
  it('prints the ledger the agent gets back, off the same run, and it reconciles', async () => {
    const { container } = render(<LandingHero />);
    await waitFor(() => expect(container.querySelector('.hero-ledger')).toBeTruthy());

    // Every value on the ledger is read off a second run of the same specimen, so a figure
    // typed into the markup rather than measured would fail here.
    const specimen = await buildSpecimen();
    const expected = await specimenResult(specimen);
    const row = (field: string) => {
      const dt = [...container.querySelectorAll('.hero-ledger dt')]
        .find(d => d.textContent === field);
      return dt?.nextElementSibling?.textContent ?? null;
    };

    expect(row('status')).toBe(expected.status);
    expect(row('requested')).toBe(String(expected.requested));
    expect(row('applied')).toBe(String(expected.applied));
    expect(row('replan required')).toBe(expected.replan_required ? 'yes' : 'no');

    const referred = specimen.authority.referred.length;
    expect(expected.referred!.count).toBe(referred);
    expect(row('referred')).toBe(`${referred} to a ${expected.referred!.awaiting}`);
    expect(expected.status).toBe('partially_applied');
    expect(expected.applied).toBe(specimen.diff.totals.records - referred);

    // applied plus every rejected count equals requested, and the sum line says so.
    const sum = expected.applied
      + expected.rejected.reduce((n: number, r: { count: number }) => n + r.count, 0);
    expect(sum).toBe(expected.requested);
    const terms = [expected.applied, ...expected.rejected.map((r: { count: number }) => r.count)];
    expect(flat(container.querySelector('.hero-check')!))
      .toBe(`${terms.join(' + ')} = ${expected.requested}`);

    // The ledger sits under the fold, beside the path it completes.
    expect(container.querySelector('.hero-below .hero-ledger')).toBeTruthy();

    // The live register was not written: the specimen's stamp ran against a copy.
    const { store } = await import('../../domain/store');
    expect(Object.values(store.state.shipments).every(s => s.remedy === null)).toBe(true);
  });
});
