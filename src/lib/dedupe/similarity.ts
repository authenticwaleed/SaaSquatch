/**
 * String similarity for company-name matching.
 *
 * Sørensen–Dice over character bigrams: cheap, dependency-free, and forgiving of
 * the word-order and suffix noise that dominates scraped company names
 * ("Brennan Heating & Air" vs "Brennan Heating and Air Inc").
 */

function bigrams(input: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < input.length - 1; i++) {
    const pair = input.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

/** 0 (nothing in common) to 1 (identical). */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const left = bigrams(a);
  const right = bigrams(b);

  let overlap = 0;
  let leftTotal = 0;
  for (const [pair, count] of left) {
    leftTotal += count;
    const other = right.get(pair);
    if (other) overlap += Math.min(count, other);
  }

  let rightTotal = 0;
  for (const count of right.values()) rightTotal += count;

  return (2 * overlap) / (leftTotal + rightTotal);
}

/** Digits only, last 10 — so "+1 (419) 555-0100" and "419-555-0100" match. */
export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}
