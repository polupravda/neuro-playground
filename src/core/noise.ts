// SEEDED NOISE — the one owner.
//
// ⚠ THIS EXISTED FOUR TIMES (21c-17). `core/patchClamp.ts`, `stage/permeaScene.ts`,
// `stage/capacitorScene.ts` and `stage/lipidLabScene.ts` each carried a private,
// byte-identical copy, against this app's own rule that a second copy of a fixed
// bug is a bug that comes back. Unifying them was provably safe precisely
// because they were identical — the same formula, so the same numbers, so every
// drawing that depends on them is unchanged.
//
// ⚠ AND IT IS FOR TWO-KEY NOISE, not for a sequence of draws. `Math.sin` hashes
// decorrelate well across two independent keys — a lipid's index against a
// purpose — which is what every caller here wants: "this molecule's wobble",
// "this ion's starting x". A single incrementing counter is a different job; if
// one is ever needed, give it its own function rather than feeding `i, i+1, …`
// into this one.

/** Deterministic noise in [0, 1) for a pair of keys. The app's ONLY randomness:
 *  nothing here ever calls `Math.random`, so a scene drawn twice is drawn the
 *  same, and a test can walk it. */
export function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}
