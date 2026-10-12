import { describe, expect, it } from 'vitest';
import type { EmplacementCarte, LivreRecu } from './livre';
import { bilanPenetration, duNom, pochesPenetration } from './penetration';

const carte = (itemId: string, numero: number, nom: string, o: Partial<EmplacementCarte> = {}): EmplacementCarte => ({
  etat: 'plein',
  designe: true,
  kind: 'carte',
  itemId,
  carteId: `c${numero}`,
  numero,
  nom,
  rang: 'A',
  limite: 3,
  apparence: 'normale',
  badge: null,
  provenance: 'Balise',
  obtenue: '14h02',
  engagee: false,
  ...o,
});
const livre: LivreRecu = {
  gele: false,
  cartesDesignees: 3,
  total: 3,
  libresUtilises: 0,
  objets: [],
  placesObjets: 8,
  pages: [
    [
      carte('a', 10, 'Le rurubu d’or'),
      carte('b', 12, 'Le dictionnaire d’or', { provenance: 'Volée à Kirua' }),
      { etat: 'vide', designe: true, carte: { numero: 13, nom: 'Le carnet du bonheur', rang: 'B' } },
      carte('c', 17, 'Le souffle du grand ange', { provenance: 'Échange avec Biscuit' }),
    ],
  ],
};

describe('page ⑨ : Pénétration', () => {
  it('RG-8.9 : doublon déguisé → sa vraie carte ; copie → « contrefaçon de… » ; provenance (RG-8.8)', () => {
    const poches = pochesPenetration(livre, 1, {
      sort: 'analyse',
      resultat: 'reussi',
      contrefacons: ['b', 'c'],
      demasquees: [
        { itemId: 'b', nature: 'deguise', vraie: { numero: 7, nom: 'La pierre de grossesse', rang: 'A' } },
        { itemId: 'c', nature: 'copie', vraie: null },
      ],
    });
    expect(poches.map((p) => p.type)).toEqual(['carte', 'carte', 'absente', 'carte']);
    expect(poches[0]).toMatchObject({ demasquee: null });
    expect(bilanPenetration(poches)).toEqual({
      titre: '2 cartes démasquées, rangées dans tes emplacements libres :',
      lignes: ['012 était la pierre de grossesse déguisée (Volée à Kirua).', '017 : contrefaçon du souffle du grand ange (Échange avec Biscuit).'],
    });
  });

  it('page propre : rien de démasqué', () => {
    const poches = pochesPenetration(livre, 1, { sort: 'analyse', resultat: 'reussi', contrefacons: [], demasquees: [] });
    expect(bilanPenetration(poches)).toEqual({ titre: 'Aucune contrefaçon sur cette page : tes cartes sont vraies.', lignes: [] });
  });

  it('« du », « de la », « de l’ », « des »', () => {
    expect(['Le lac', 'La balance', 'L’oreiller', 'Les ciseaux', 'Maid panda'].map(duNom)).toEqual(['du lac', 'de la balance', 'de l’oreiller', 'des ciseaux', 'de Maid panda']);
  });
});
