// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BlastRadius } from '../BlastRadius';

/**
 * F6: the extent figures moved as the operator unticked rows — 23 records became 22, the caption
 * restated it in words — and nothing was announced. DESIGN.md's own rule is that motion never
 * carries meaning on its own; a figure that only changes on screen breaks the same rule.
 *
 * The fix announces the sentence that already exists rather than writing a new one, and only one
 * of them: two live regions on one panel would read the same change out twice.
 */
describe('BlastRadius announces the figures it restates (F6)', () => {
  afterEach(cleanup);

  const props = {
    requested: 47, datasetSize: 200, valueDelta: -1200,
    showMoney: true, irreversible: 0, actionsOnly: false,
  };

  it('puts the caption in a polite live region', () => {
    render(<BlastRadius records={23} {...props} />);
    const status = screen.getByRole('status');
    expect(status.className).toContain('br-caption');
    expect(status.textContent).toMatch(/23 of 200 shipments in the register/);
    expect(status.textContent).toMatch(/struck down from 47/);
  });

  it('announces the new count when a row is unticked', () => {
    const { rerender } = render(<BlastRadius records={23} {...props} />);
    rerender(<BlastRadius records={22} {...props} />);
    expect(screen.getByRole('status').textContent).toMatch(/22 of 200/);
  });

  it('carries exactly one live region, so one change is not read out twice', () => {
    render(<BlastRadius records={23} {...props} />);
    expect(document.querySelectorAll('[aria-live],[role="status"],[role="alert"],output').length).toBe(1);
  });
});
