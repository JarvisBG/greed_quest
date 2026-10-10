import { describe, expect, it } from 'vitest';
import { cartesEchangeables, messageFin, partVide, resumePart, termine } from './echanges';
import { offreMin } from './encheres';
import type { LivreRecu } from './livre';
import { lireQrLieu } from './qr';

const carte = (itemId: string, o: Partial<{ engagee: boolean; apparence: 'normale' | 'grisee' }> = {}) => ({
  etat: 'plein' as const,
  kind: 'carte' as const,
  itemId,
  carteId: `c-${itemId}`,
  numero: 1,
  nom: itemId,
  rang: 'C' as const,
  designe: true,
  engagee: o.engagee ?? false,
  apparence: o.apparence ?? 'normale',
  badge: null,
  provenance: 'Balise',
  obtenue: '14h05',
});
const livre: LivreRecu = {
  gele: false,
  cartesDesignees: 3,
  total: 30,
  libresUtilises: 1,
  objets: [],
  placesObjets: 8,
  pages: [[carte('a'), carte('b', { engagee: true }), carte('c', { engagee: true }), carte('g', { apparence: 'grisee' }), { etat: 'plein', kind: 'sort', designe: false, itemId: 's', sort: 'vol' }]],
};
const part = (ids: string[], jenny = 0) => ({ cartes: ids.map((itemId) => ({ itemId, carteId: null, nom: itemId, rang: null })), jenny });

describe('échanges côté app (RG-11.1 amendé)', () => {
  it('cartes proposables : les miennes, pas les sorts ni les contrefaçons démasquées ; une carte engagée dans CET échange reste proposée', () => {
    expect(cartesEchangeables(livre, part(['b'])).map((c) => c.itemId)).toEqual(['a', 'b']);
  });

  it('RG-11.2 : part vide = ni carte ni jenny', () => {
    expect(partVide(part([]))).toBe(true);
    expect(partVide(part([], 5))).toBe(false);
    expect(partVide(part(['a']))).toBe(false);
  });

  it('résumé d’une part et messages de fin', () => {
    expect(resumePart({ cartes: [{ itemId: 'x', carteId: 'c', nom: 'Épée', rang: 'S' }], jenny: 20 })).toBe('Épée (S), 20 J');
    expect(resumePart(part([]))).toBe('rien pour l’instant');
    expect(messageFin('conclu', 'Kirua')).toBe('Échange conclu avec Kirua !');
    expect(messageFin('expire', null)).toMatch(/expiré/);
    expect(termine('composition')).toBe(false);
    expect(termine('annule')).toBe(true);
  });
});

describe('lieux et enchères', () => {
  it('RG-9.2 / RG-11.4 : QR de lieu brut ou en lien ?lieu=', () => {
    expect(lireQrLieu('Ab_9-xyzABCDEFGH')).toBe('Ab_9-xyzABCDEFGH');
    expect(lireQrLieu('https://jeu.example/?lieu=Ab_9-xyzABCDEFGH')).toBe('Ab_9-xyzABCDEFGH');
    expect(lireQrLieu('pas un qr de lieu')).toBeNull();
  });

  it('RG-11.4 : offre minimale', () => {
    expect(offreMin({ prixDepart: 10, meilleureOffre: null })).toBe(10);
    expect(offreMin({ prixDepart: 10, meilleureOffre: { montant: 30 } })).toBe(31);
  });
});
