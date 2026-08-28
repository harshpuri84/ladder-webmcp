import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import {
  ROLES, authorityConfigured, authorityVocabulary, configureAuthority, currentRole,
  describeAuthority, isReferable, onRoleChange, referralTarget, setRole,
  type AuthorityVocabulary,
} from '../authority';

/**
 * The bound, driven off a vocabulary that is neither product's. That is the point of this file:
 * nothing in `authority.ts` may know what a record is called or what a limit is measured in, so
 * the suite that tests it supplies a third set of words and asserts the module speaks them back.
 * A test written in euros here would be the defect it is meant to prevent.
 */
const TEST_VOCAB: AuthorityVocabulary = {
  roles: [
    { id: 'junior', label: 'Junior keeper', limit: 4 },
    { id: 'senior', label: 'Senior keeper', limit: 40 },
  ],
  record: 'enclosure',
  bound: 'feeding authority',
  carries: 'moves feed',
  amount: (n: number) => `${n} kg of feed`,
};

beforeAll(() => configureAuthority(TEST_VOCAB));
afterEach(() => setRole(ROLES[0].id));

describe('the authority bound', () => {
  it('is unconfigured until a host hands its words over', () => {
    // Configured by this suite's own beforeAll — the flag exists so `composedDescription` can
    // stay silent about a boundary no host has stated yet.
    expect(authorityConfigured()).toBe(true);
    expect(authorityVocabulary().record).toBe('enclosure');
  });

  it('takes its roles from the host, in the host ladder order', () => {
    expect(ROLES.map(r => r.id)).toEqual(['junior', 'senior']);
    expect(currentRole().id).toBe(ROLES[0].id);
    // The ordering is the escalation path, so this is load-bearing rather than cosmetic: a
    // list sorted the other way would refer everything downward.
    expect(ROLES[0].limit).toBeLessThan(ROLES[1].limit);
  });

  it('refers a record above the limit and authorises one exactly on it', () => {
    const role = ROLES[0];
    expect(isReferable(role.limit, role)).toBe(false);
    expect(isReferable(role.limit + 1, role)).toBe(true);
    expect(isReferable(0, role)).toBe(false);
  });

  it('reads the value as a magnitude, so a credit of the same size is the same size of decision', () => {
    const role = ROLES[0];
    expect(isReferable(-(role.limit + 1), role)).toBe(true);
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
    expect(() => setRole('senior-keeper-with-no-limit')).not.toThrow();
    expect(fired).toBe(1);
    expect(currentRole().id).toBe(ROLES[1].id);

    off();
  });

  it('describes the limit in the host’s unit and the host’s word for one record', () => {
    expect(describeAuthority(ROLES[0])).toBe('may authorise up to 4 kg of feed on one enclosure');
    // The whole defect this file exists to lock: no currency, no freight noun, nothing the
    // module invented for itself.
    expect(describeAuthority(ROLES[0])).not.toMatch(/EUR|shipment/);
  });

  it('re-binding replaces the ladder and puts the operator back on its lowest rung', () => {
    setRole(ROLES[1].id);
    expect(currentRole().id).toBe('senior');

    configureAuthority({
      ...TEST_VOCAB,
      roles: [{ id: 'warden', label: 'Warden', limit: 1 }],
    });
    expect(ROLES.map(r => r.id)).toEqual(['warden']);
    expect(currentRole().id).toBe('warden');
    expect(referralTarget(currentRole())).toBeNull();

    configureAuthority(TEST_VOCAB);
    expect(currentRole().id).toBe('junior');
  });
});
