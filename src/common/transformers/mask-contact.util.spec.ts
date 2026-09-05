import {
  maskEmail,
  maskPhone,
  maskReviewAuthorDisplay,
} from './mask-contact.util';

describe('mask-contact.util', () => {
  it('masks Korean mobile numbers', () => {
    expect(maskPhone('01012345678')).toBe('010-****-5678');
  });

  it('masks email local part', () => {
    expect(maskEmail('jaerok@gmail.com')).toBe('ja****@gmail.com');
  });

  it('prefers phone over email for review author display', () => {
    expect(
      maskReviewAuthorDisplay({
        phone: '01012345678',
        email: 'jaerok@gmail.com',
      }),
    ).toBe('010-****-5678');
  });

  it('falls back to masked email when phone is missing', () => {
    expect(
      maskReviewAuthorDisplay({
        email: 'jaerok@gmail.com',
      }),
    ).toBe('ja****@gmail.com');
  });

  it('reuses an already masked fallback', () => {
    expect(
      maskReviewAuthorDisplay({
        fallback: '010-****-5678',
      }),
    ).toBe('010-****-5678');
  });
});

  it('masks email when customer_phone duplicates the email address', () => {
    expect(
      maskReviewAuthorDisplay({
        phone: 'traveler@gmail.com',
        email: 'traveler@gmail.com',
      }),
    ).toBe('tr****@gmail.com');
  });
