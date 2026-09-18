import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../src/utils/password.utils.js';

describe('password.utils — isStrongPassword', () => {
  test('accepts a password with 8+ chars, a letter, and a digit', () => {
    console.log('[TEST] isStrongPassword › accepts a compliant password');
    expect(isStrongPassword('Password1')).toBe(true);
    expect(isStrongPassword('abcdefg1')).toBe(true);
  });

  test('rejects passwords shorter than 8 characters', () => {
    console.log('[TEST] isStrongPassword › rejects short passwords');
    expect(isStrongPassword('Ab1')).toBe(false);
    expect(isStrongPassword('Passw1')).toBe(false);
  });

  test('rejects passwords with no digit', () => {
    console.log('[TEST] isStrongPassword › rejects letters-only passwords');
    expect(isStrongPassword('OnlyLetters')).toBe(false);
  });

  test('rejects passwords with no letter', () => {
    console.log('[TEST] isStrongPassword › rejects digits-only passwords');
    expect(isStrongPassword('12345678')).toBe(false);
  });

  test('rejects non-string or empty input', () => {
    console.log('[TEST] isStrongPassword › rejects non-string/empty input');
    expect(isStrongPassword('')).toBe(false);
    expect(isStrongPassword(undefined)).toBe(false);
    expect(isStrongPassword(null)).toBe(false);
    expect(isStrongPassword(12345678)).toBe(false);
  });

  test('exposes a user-facing policy message describing the rule', () => {
    console.log('[TEST] isStrongPassword › policy message mentions 8 characters, letter and number');
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/8 characters/i);
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/letter/i);
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/number/i);
  });
});
