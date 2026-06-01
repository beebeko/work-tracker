/**
 * Generates a unique invoice prefix from a client name.
 *
 * Strategy:
 *   1. Take the first uppercase letter of each word → base prefix (e.g. "Be My Horsey" → "BMH")
 *   2. If that collides, extend with the next letter of the last word ("BMHO", "BMHR", ...)
 *   3. If still colliding, fall back to numeric suffix ("BMH2", "BMH3", ...)
 *   4. If no valid base can be derived (no alphabetic characters), return "" (user must fill in)
 *
 * @param name            The client name to derive a prefix from.
 * @param existingPrefixes Prefixes already in use (case-insensitive comparison).
 */
export function generateInvoicePrefix(name: string, existingPrefixes: string[]): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const base = words
    .map((w) => w[0]?.toUpperCase())
    .filter((c): c is string => Boolean(c) && /[A-Z]/.test(c))
    .join('');

  if (!base) return '';

  const existing = new Set(existingPrefixes.map((p) => p.toUpperCase()));

  if (!existing.has(base)) return base;

  // Extend with subsequent letters of the last word
  const lastWord = words[words.length - 1];
  for (let i = 1; i < lastWord.length; i++) {
    const c = lastWord[i]?.toUpperCase();
    if (c && /[A-Z]/.test(c)) {
      const candidate = base + c;
      if (!existing.has(candidate)) return candidate;
    }
  }

  // Numeric fallback
  for (let n = 2; n <= 99; n++) {
    const candidate = `${base}${n}`;
    if (!existing.has(candidate)) return candidate;
  }

  return ''; // give up — user must fill in manually
}
