/**
 * All monetary accumulation in the seed generator happens in integer
 * paise (1 rupee = 100 paise), never floating-point rupees, so summing
 * 50,000 amounts can't accumulate binary-rounding drift. Conversion to a
 * NUMERIC(15,2)-compatible decimal string happens exactly once, here, at
 * the boundary before a value is written to the database.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToDecimalString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const wholePart = Math.trunc(abs / 100);
  const fractionPart = abs % 100;
  return `${sign}${wholePart}.${String(fractionPart).padStart(2, "0")}`;
}

/** Inverse of paiseToDecimalString - string-based, never floating-point. */
export function decimalStringToPaise(value: string): number {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Not a 2-decimal amount string: "${value}"`);
  }
  const [, sign, whole, fraction] = match;
  const magnitude = Number(whole) * 100 + Number(fraction);
  return sign === "-" ? -magnitude : magnitude;
}
