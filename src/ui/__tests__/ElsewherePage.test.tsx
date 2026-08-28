// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  ElsewherePage,
  HOST_BINDING_QUOTE,
  SECOND_PRODUCT_HREF,
} from '../pages/ElsewherePage';
// The adapter's own source, as text. Vite's `?raw` rather than `node:fs`, because this suite
// runs in the jsdom environment and the app's tsconfig carries no node types — and because the
// point of the assertion is that the quote matches the module the app actually builds against.
import adapterSource from '../../webmcp/adapter.ts?raw';

/**
 * The page's claim is that the engine is domain-free, and the only two things that can settle
 * it are an interface a reader can open and a second product they can run. So this file guards
 * exactly those two: the quoted interface still matches the file it was quoted from, and the
 * pointer to the second product is a real address.
 *
 * The second of those FAILS ON PURPOSE until the second product's URL exists. That is the
 * point of it. A dead pointer standing where the proof belongs is the one defect on this page
 * that a reader cannot detect and a judge can, so the build says so out loud instead.
 */

const flat = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Member names off a TypeScript interface body, in the order they are declared. */
const membersOf = (body: string) =>
  [...body.matchAll(/^ {2}(\w+)\??[(:]/gm)].map(m => m[1]);

describe('ElsewherePage', () => {
  afterEach(cleanup);

  it('sets out the three sections the argument needs', () => {
    render(<ElsewherePage />);
    for (const heading of [
      'What an application has to hand it',
      'The same decision, other records',
      'The second one is wired, not drawn',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    }
  });

  it('quotes the interface rather than describing it, and quotes it correctly', () => {
    const declared = adapterSource.split('export interface HostBinding<S> {')[1]?.split('\n}')[0];
    expect(declared, 'HostBinding has moved or been renamed in adapter.ts').toBeTruthy();

    const quoted = HOST_BINDING_QUOTE.split('{')[1].split('\n}')[0];
    expect(membersOf(quoted)).toEqual(membersOf(declared!));
    expect(membersOf(quoted).length).toBe(8);
  });

  it('renders the quoted interface where a reader can reach it with a keyboard', () => {
    render(<ElsewherePage />);
    const block = document.querySelector('.pr-payload');
    expect(block?.getAttribute('tabindex')).toBe('0');
    expect(flat(block!)).toContain('interface HostBinding<S>');
  });

  it('states the two other kinds of work without drawing either of them', () => {
    render(<ElsewherePage />);
    const page = flat(document.querySelector('main')!);
    expect(page).toContain('A retail repricing.');
    expect(page).toContain('An edge config rollout.');
    // The mockups were cut on 27 August 2026. Nothing on this tab is a walkthrough any more,
    // and nothing on it should ever need the disclaimer that came with one.
    expect(page).not.toMatch(/mockup|not wired|drawn, not/i);
  });

  it('says TODO in the rendered text while the second product has no address', () => {
    render(<ElsewherePage />);
    const page = flat(document.querySelector('main')!);
    const placeholder = document.querySelector('.ew-todo');
    if (SECOND_PRODUCT_HREF.startsWith('https://')) {
      expect(placeholder).toBeNull();
      expect(page).not.toContain('TODO');
    } else {
      expect(placeholder, 'the href is a placeholder but nothing on the page says so').toBeTruthy();
      expect(page).toContain('TODO');
    }
  });

  /**
   * The gate. Red until the second product is live, by design — see this file's head.
   * When its URL exists, put it in `SECOND_PRODUCT_HREF` and this goes green on its own.
   */
  it('points at the second product with a real address', () => {
    expect(
      SECOND_PRODUCT_HREF,
      'SECOND_PRODUCT_HREF in src/ui/pages/ElsewherePage.tsx is still the placeholder. '
        + 'This test is meant to be red until the second product is live: put its URL in that '
        + 'constant and it passes. Do not delete it to get a green run.',
    ).toMatch(/^https:\/\/[^\s]+$/);
  });
});
