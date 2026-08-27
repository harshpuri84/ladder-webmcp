import { describe, it, expect, afterEach } from 'vitest';
import {
  ROLES, currentRole, describeAuthority, isReferable, onRoleChange, referralTarget, setRole,
} from '../authority';

afterEach(() => setRole(ROLES[0].id));

describe('the spend authority bound', () => {
  it('starts on the lowest role in the ladder, not the highest', () => {
    expect(currentRole().id).toBe(ROLES[0].id);
    // The ordering is the escalation path, so this is load-bearing rather than cosmetic: a
    // list sorted the other way would refer everything downward.
    expect(ROLES[0].spendLimitEur).toBeLessThan(ROLES[1].spendLimitEur);
  });

  it('refers a row above the limit and authorises one exactly on it', () => {
    const role = ROLES[0];
    expect(isReferable(role.spendLimitEur, role)).toBe(false);
    expect(isReferable(role.spendLimitEur + 1, role)).toBe(true);
    expect(isReferable(0, role)).toBe(false);
  });

  it('reads spend as a magnitude, so a credit of the same size is the same size of decision', () => {
    const role = ROLES[0];
    expect(isReferable(-(role.spendLimitEur + 1), role)).toBe(true);
  });

  it('names the next role up as the referral target, and nobody above the top of the ladder', () => {
    expect(referralTarget(ROLES[0])?.id).toBe(ROLES[1].id);
    expect(referralTarget(ROLES[ROLES.length - 1])).toBeNull();
  });

  it('notifies on a real change only — not on re-selecting the role already in effect', () => {
    let fired = 0;
    const off = onRoleChange(() => { fired++; });

    setRole(ROLES[0].id);
    expect(fired).toBe(0);

    setRole(ROLES[1].id);
    expect(fired).toBe(1);
    expect(currentRole().id).toBe(ROLES[1].id);

    // An id nothing in the ladder answers to must not silently leave the operator unbounded.
    setRole('duty-manager-with-no-limit');
    expect(fired).toBe(1);
    expect(currentRole().id).toBe(ROLES[1].id);

    off();
  });

  it('describes the limit in the words the strip, the tool description and the receipt share', () => {
    expect(describeAuthority(ROLES[0])).toBe(`may authorise up to EUR ${ROLES[0].spendLimitEur} on one shipment`);
  });
});
