// Page ⑦ Book : pages désignées / libres, Clear, Solidité, étiquette des pochettes.
import { describe, expect, it } from 'vitest';
import { cartesASceller, clearPossible, etiquetteDe, genreDePage, nombreDePages, rangDePage, type Emplacement, type EmplacementCarte, type LivreRecu } from './livre';

const carte = (numero: number, autre: Partial<EmplacementCarte> = {}): EmplacementCarte => ({
  etat: 'plein',
  designe: true,
  kind: 'carte',
  itemId: `x${numero}`,
  carteId: `c${numero}`,
  apparence: 'normale',
  badge: null,
  provenance: 'Balise',
  obtenue: '14h00',
  engagee: false,
  numero,
  nom: `Carte ${numero}`,
  rang: 'C',
  ...autre,
});
const libre: Emplacement = { etat: 'vide', designe: false };
const livre = (pages: Emplacement[][], autre: Partial<LivreRecu> = {}): LivreRecu => ({ gele: false, cartesDesignees: 1, total: 2, libresUtilises: 0, pages, objets: [], placesObjets: 8, ...autre });

describe('RG-8.5 : pages du Book', () => {
  const l = livre([[carte(0), { etat: 'vide', designe: true, carte: { numero: 3, nom: 'Trois', rang: 'B' } }], [libre, libre], [libre]]);

  it('RG-8.5 : page désignée si elle porte un emplacement désigné, libre sinon', () => {
    expect([0, 1, 2].map((i) => genreDePage(l, i))).toEqual(['designee', 'libre', 'libre']);
  });

  it('Objets (amendement 2026-10-10) : une page à part, après les libres', () => {
    expect(nombreDePages(l)).toBe(4);
    expect(genreDePage(l, 3)).toBe('objets');
    expect(rangDePage(l, 3)).toEqual({ rang: 1, sur: 1 });
  });

  it('RG-8.5 : rang de la page parmi celles de son genre', () => {
    expect(rangDePage(l, 0)).toEqual({ rang: 1, sur: 1 });
    expect(rangDePage(l, 2)).toEqual({ rang: 2, sur: 2 });
  });
});

describe('RG-13.1 : Clear proposé', () => {
  it('RG-13.1 : seulement quand toutes les désignées sont en place et le Book pas gelé', () => {
    expect(clearPossible(livre([], { cartesDesignees: 2, total: 2 }))).toBe(true);
    expect(clearPossible(livre([], { cartesDesignees: 1, total: 2 }))).toBe(false);
    expect(clearPossible(livre([], { cartesDesignees: 2, total: 2, gele: true }))).toBe(false);
    expect(clearPossible(livre([], { cartesDesignees: 0, total: 0 }))).toBe(false);
  });
});

describe('Objets : Solidité et étiquettes', () => {
  it('Solidité : ni les cartes engagées dans un échange ni celles déjà scellées', () => {
    const l = livre([[carte(1), carte(2, { engagee: true }), carte(3, { coffreJusqua: '14h20' })]]);
    expect(cartesASceller(l).map((e) => e.itemId)).toEqual(['x1']);
  });

  it('RG-8.9 : la malédiction et la contrefaçon passent avant le reste', () => {
    expect(etiquetteDe(carte(1, { badge: 'maudite', engagee: true }))).toEqual({ texte: 'Maudite', alerte: true });
    expect(etiquetteDe(carte(1, { badge: 'contrefacon' }))?.texte).toBe('Contrefaçon');
    expect(etiquetteDe(carte(1, { cachee: true }))).toEqual({ texte: 'Cachée', alerte: false });
    expect(etiquetteDe(carte(1))).toBeNull();
  });
});
