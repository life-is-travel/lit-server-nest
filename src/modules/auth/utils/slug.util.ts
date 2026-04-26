import { randomBytes } from 'crypto';

const MAX_SLUG_LENGTH = 60;

export const slugify = (input: string): string => {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
};

export const createFallbackStoreSlug = (): string => {
  return `store-${randomBytes(4).toString('hex').slice(0, 6)}`;
};
