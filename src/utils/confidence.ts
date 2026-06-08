/**
 * Resolves a confidence score (0–1) to a theme color token.
 * ≥ 0.8 → success (green), ≥ 0.5 → warning (yellow), < 0.5 → danger (red)
 */
export function resolveConfidenceColor(
  confidence: number,
  colors: { success: string; warning: string; danger: string },
): string {
  if (confidence >= 0.8) return colors.success;
  if (confidence >= 0.5) return colors.warning;
  return colors.danger;
}
