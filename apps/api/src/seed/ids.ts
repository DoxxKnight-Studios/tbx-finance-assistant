/**
 * Deterministic UUID-shaped identifiers derived from a label rather than
 * true randomness, so re-running the seed with the same SEED constant
 * regenerates byte-identical account_id/transaction_id values every
 * time. Not cryptographically unique - fine for a bounded, known-size
 * synthetic dataset (100 accounts, 50,000 transactions) where every
 * label is distinct by construction.
 */

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deterministicUuid(label: string): string {
  const full =
    fnv1a(`${label}#a`).toString(16).padStart(8, "0") +
    fnv1a(`${label}#b`).toString(16).padStart(8, "0") +
    fnv1a(`${label}#c`).toString(16).padStart(8, "0") +
    fnv1a(`${label}#d`).toString(16).padStart(8, "0");

  return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20, 32)}`;
}
