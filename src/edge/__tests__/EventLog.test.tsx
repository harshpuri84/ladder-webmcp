// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EventLog } from '../ui/EventLog';

/**
 * The log is the first thing on the panel that moves when a call lands, which makes its empty
 * line the best-placed sentence in the product for saying that this instrument is driven by an
 * agent at all. It used to spend that slot reporting its own emptiness.
 */
describe('the run log before anything has run', () => {
  afterEach(cleanup);

  it('says what will appear here, not merely that nothing has', () => {
    render(<EventLog />);
    const line = screen.getByText(/Empty until an agent calls a tool/);
    expect(line.textContent).toMatch(/the tool, sites applied of\s+sites requested/);
    expect(line.textContent).toMatch(/any rotation it paged/);
  });
});
