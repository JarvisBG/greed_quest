// Tout aléa de l'engine passe par un Rng injecté : tests déterministes et simulation reproductible.

export interface Rng {
  /** Flottant uniforme dans [0, 1). */
  next(): number;
}

/** Générateur seedé (mulberry32). Suffisant pour le jeu, pas pour de la crypto. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Rng qui rejoue une suite fixe de valeurs (tests). */
export function sequenceRng(values: readonly number[]): Rng {
  let i = 0;
  return {
    next() {
      const v = values[i++];
      if (v === undefined) throw new Error('sequenceRng épuisé');
      return v;
    },
  };
}

/** Entier uniforme dans [0, n). */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng.next() * n);
}

/** Élément uniforme d'une liste non vide. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick sur une liste vide');
  return items[randomInt(rng, items.length)] as T;
}

/**
 * Tirage pondéré. Les poids nuls ou négatifs sont ignorés.
 * Retourne undefined si la somme des poids est nulle.
 */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T | undefined {
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const [item, w] of entries) {
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return item;
  }
  // Arrondi flottant : on retombe sur le dernier poids positif.
  return [...entries].reverse().find(([, w]) => w > 0)?.[0];
}
