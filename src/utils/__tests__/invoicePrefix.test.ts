import { generateInvoicePrefix } from '../../utils/invoicePrefix';

describe('generateInvoicePrefix', () => {
  it('returns initials of each word', () => {
    expect(generateInvoicePrefix('Be My Horsey', [])).toBe('BMH');
  });

  it('handles single word', () => {
    expect(generateInvoicePrefix('Acme', [])).toBe('A');
  });

  it('handles two-word name', () => {
    expect(generateInvoicePrefix('John Smith', [])).toBe('JS');
  });

  it('is case-insensitive for collision check', () => {
    expect(generateInvoicePrefix('Be My Horsey', ['bmh'])).not.toBe('BMH');
  });

  it('extends with next letter of last word when base collides', () => {
    // BMH collides, extends to BMHO (next letter of "Horsey")
    const result = generateInvoicePrefix('Be My Horsey', ['BMH']);
    expect(result).toBe('BMHO');
  });

  it('continues extending when extended also collides', () => {
    const result = generateInvoicePrefix('Be My Horsey', ['BMH', 'BMHO']);
    expect(result).toBe('BMHR');
  });

  it('falls back to numeric suffix when all letter extensions collide', () => {
    // Exhaust all alpha extensions of "AB" (all chars of last word)
    const existing = ['AB', 'ABB'];
    const result = generateInvoicePrefix('A B', existing);
    expect(result).toBe('AB2');
  });

  it('increments numeric suffix if first fallback collides', () => {
    const existing = ['AB', 'ABB', 'AB2'];
    const result = generateInvoicePrefix('A B', existing);
    expect(result).toBe('AB3');
  });

  it('returns empty string for empty name', () => {
    expect(generateInvoicePrefix('', [])).toBe('');
  });

  it('returns empty string for whitespace-only name', () => {
    expect(generateInvoicePrefix('   ', [])).toBe('');
  });

  it('skips non-alphabetic leading characters', () => {
    // "123" word has no alpha leading char — should be skipped
    const result = generateInvoicePrefix('123 Productions', []);
    expect(result).toBe('P');
  });

  it('handles names with extra whitespace', () => {
    expect(generateInvoicePrefix('  Big  Sky  ', [])).toBe('BS');
  });
});
