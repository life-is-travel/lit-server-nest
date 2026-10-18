import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  INVITE_CODE_ALPHABET,
  normalizeInviteCode,
} from './invite-code.util';

describe('invite-code.util', () => {
  it('generates 8 characters without ambiguous letters', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();

      expect(code).toHaveLength(8);
      expect([...code].every((ch) => INVITE_CODE_ALPHABET.includes(ch))).toBe(
        true,
      );
    }
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
  });

  it('formats as ABCD-EFGH and normalizes user input back', () => {
    expect(formatInviteCode('ABCDEFGH')).toBe('ABCD-EFGH');
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('ab cd ef gh')).toBe('ABCDEFGH');
  });

  it('hashes the normalized code with sha256 hex', () => {
    const hash = hashInviteCode('abcd-efgh');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashInviteCode('ABCDEFGH'));
  });
});
