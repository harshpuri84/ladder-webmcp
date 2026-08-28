// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExposureMeter } from '../ui/ExposureMeter';

/**
 * F6, this product's half. The exposure figure and the latched count move as the engineer
 * unlatches sites, and the drawer announced none of it — in a panel whose stated rule is that
 * status is carried by form first and colour never alone.
 */
describe('ExposureMeter announces the reading it prints (F6)', () => {
  afterEach(cleanup);

  it('puts the exposure reading in a polite live region', () => {
    render(<ExposureMeter selectedPct={2.66} requestedPct={7.86} marked={22} requested={36} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/2\.66%/);
    expect(status.textContent).toMatch(/of 7\.86% proposed/);
    expect(status.textContent).toMatch(/22 of 36 sites latched/);
  });

  it('announces the new reading when a site is unlatched', () => {
    const { rerender } = render(
      <ExposureMeter selectedPct={2.66} requestedPct={7.86} marked={22} requested={36} />,
    );
    rerender(<ExposureMeter selectedPct={1.41} requestedPct={7.86} marked={21} requested={36} />);
    expect(screen.getByRole('status').textContent).toMatch(/21 of 36 sites latched/);
  });

  it('carries exactly one live region, so one change is not read out twice', () => {
    render(<ExposureMeter selectedPct={2.66} requestedPct={7.86} marked={22} requested={36} />);
    expect(document.querySelectorAll('[aria-live],[role="status"],[role="alert"],output').length).toBe(1);
  });
});
