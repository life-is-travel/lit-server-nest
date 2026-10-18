import { createHash, randomInt } from 'crypto';

/** 헷갈리는 문자(0·O·1·I·L)를 뺀 대문자·숫자. */
export const INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const INVITE_CODE_LENGTH = 8;

export const generateInviteCode = (): string =>
  Array.from(
    { length: INVITE_CODE_LENGTH },
    () => INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)],
  ).join('');

/** 사람이 읽기 쉽게 `ABCD-EFGH`로 나눈다. */
export const formatInviteCode = (code: string): string =>
  `${code.slice(0, 4)}-${code.slice(4)}`;

/** 입력의 하이픈·공백·대소문자 차이를 없앤다. */
export const normalizeInviteCode = (input: string): string =>
  input.replace(/[^0-9a-z]/gi, '').toUpperCase();

/** 저장·조회용 해시. 평문 코드는 DB에 남기지 않는다. */
export const hashInviteCode = (input: string): string =>
  createHash('sha256').update(normalizeInviteCode(input)).digest('hex');
