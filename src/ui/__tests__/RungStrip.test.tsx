// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { registerLadderTool as RegisterLadderTool } from '../../webmcp/adapter';
import type { RungStrip as RungStripType } from '../RungStrip';

/**
 * F6/F7: `new Date("T23:59:59.999Z").toISOString()` throws an uncaught RangeError when the
 * expiry field is cleared, and a past date used to be accepted silently — the form closed and
 * the chip still read "reviewed every time" correctly, but the registered tool description
 * claimed the rule was active until a date already gone. Fixed together as form validation: an
 * empty or past expiry is refused inline, before anything is written or a Date is even
 * constructed from it.
 */
describe('RungStrip rule form expiry validation (F6/F7)', () => {
  let RungStrip: typeof RungStripType;
  let registerLadderTool: typeof RegisterLadderTool;

  beforeAll(async () => {
    (document as any).modelContext = {
      registerTool: () => {},
      unregisterTool: () => {},
    };
    ({ registerLadderTool } = await import('../../webmcp/adapter'));
    ({ RungStrip } = await import('../RungStrip'));
    registerLadderTool({
      name: 'update_shipments', description: 'base description', inputSchema: { type: 'object', properties: {} },
      async exec() { return {}; },
    });
  });

  afterEach(() => cleanup());
  afterAll(() => { delete (document as any).modelContext; });

  it('refuses an empty expiry inline instead of throwing a RangeError', () => {
    render(<RungStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a standing rule' }));

    const expiryInput = screen.getByLabelText('Expires') as HTMLInputElement;
    fireEvent.change(expiryInput, { target: { value: '' } });

    // The old bug: this click threw an uncaught RangeError from inside the submit handler.
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Ratify' }))).not.toThrow();

    expect(screen.getByText(/expiry/i)).toBeTruthy();
    // Nothing was ratified — no rung-1 chip appeared.
    expect(screen.queryByText(/standing rule —/)).toBeNull();
  });

  it('refuses a past expiry inline rather than ratifying silently', () => {
    render(<RungStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a standing rule' }));

    const expiryInput = screen.getByLabelText('Expires') as HTMLInputElement;
    fireEvent.change(expiryInput, { target: { value: '2020-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ratify' }));

    expect(screen.getByText(/expiry/i)).toBeTruthy();
    expect(screen.queryByText(/standing rule —/)).toBeNull();
  });

  it('still ratifies normally with a valid future expiry', () => {
    render(<RungStrip />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a standing rule' }));

    const expiryInput = screen.getByLabelText('Expires') as HTMLInputElement;
    fireEvent.change(expiryInput, { target: { value: '2099-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ratify' }));

    expect(screen.getByText(/standing rule —/)).toBeTruthy();
  });
});
