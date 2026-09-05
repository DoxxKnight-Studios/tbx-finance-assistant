/**
 * Deterministic, schema-independent random-number utilities. Given the
 * same numeric seed, every function here produces the exact same
 * sequence of outputs every time - the seed dataset's determinism
 * depends entirely on never introducing Math.random() or wall-clock
 * time anywhere in generation.
 */

export type Rng = () => number;

/** mulberry32: small, fast, good-enough PRNG for synthetic data generation. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [min, max], inclusive on both ends. */
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[nextInt(rng, 0, items.length - 1)];
}

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = nextInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Draws a single weighted index, e.g. for picking an amount tier. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * Largest-remainder apportionment: splits `total` whole units across
 * buckets proportional to `weights`, guaranteeing the result always sums
 * to exactly `total` (unlike independent weighted random draws, which
 * only approximate their target proportions). Used wherever a count
 * must exactly match a business rule (bank/program ranking, debit vs
 * credit totals) rather than merely trend toward it.
 */
export function apportion(weights: readonly number[], total: number): number[] {
  const sumWeights = weights.reduce((sum, w) => sum + w, 0);
  const raw = weights.map((w) => (w / sumWeights) * total);
  const floors = raw.map(Math.floor);
  const assigned = floors.reduce((sum, v) => sum + v, 0);
  const remainder = total - assigned;

  const order = floors
    .map((_, i) => i)
    .sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])));

  const result = floors.slice();
  for (let k = 0; k < remainder; k += 1) {
    result[order[k % order.length]] += 1;
  }
  return result;
}
