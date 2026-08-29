// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RackFoot } from '../ui/RackFoot';

/**
 * `edge.html` was a dead end until 29 August 2026: the whole document's only `href` was the
 * favicon. The demo video shows this URL, so a judge can land here first and, from here, could
 * reach neither the argument, nor the other product on the same engine, nor the source.
 *
 * These hold the three destinations rather than the plate's prose. jsdom applies no stylesheet,
 * so the underline that makes a link findable with every colour removed is not testable here —
 * it lives in `.fo-link` and is asserted by eye against the CVD sheet, like every other form in
 * this world.
 */
afterEach(cleanup);

const hrefs = () =>
  screen.getAllByRole('link').map(a => a.getAttribute('href'));

describe('the foot plate is the way off this page', () => {
  it('links to the freight console, the problem, and the source', () => {
    render(<RackFoot />);
    expect(hrefs()).toEqual([
      '/#/proof',
      '/#/problem',
      'https://github.com/harshpuri84/ladder-webmcp',
    ]);
  });

  it('says what each destination is, so a judge picks one rather than all three', () => {
    render(<RackFoot />);
    expect(screen.getByRole('link', { name: 'The freight console' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'The problem' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Source' })).toBeTruthy();
    expect(screen.getByText(/The same engine on a cancelled flight/)).toBeTruthy();
  });
});
