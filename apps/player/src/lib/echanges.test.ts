import { describe, expect, it } from 'vitest';
import { cartesEchangeables, jete, listePart, mesPieces, messageFin, notePrix, partVide, phraseVente, resumePart, termine } from './echanges';
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
const piece = (itemId: string, rang: 'S' | 'C' | 'D', nom = itemId) => ({ itemId, kind: 'carte' as const, carteId: `c-${itemId}`, nom, rang });
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
    expect(resumePart({ cartes: [{ itemId: 'x', carteId: 'c', nom: 'Épée', rang: 'S' }], jenny: 20 })).toBe('1 carte · 1 S · 20 J');
    expect(resumePart(part([]))).toBe('rien pour l’instant');
    expect(messageFin('conclu', 'Kirua')).toBe('Échange conclu avec Kirua !');
    expect(messageFin('expire', null)).toMatch(/expiré/);
    expect(termine('composition')).toBe(false);
    expect(termine('annule')).toBe(true);
  });

  it('page ⑫ : résumé des rangs, sans verdict (« 1 grosse carte contre plusieurs petites »)', () => {
    const p = { cartes: [piece('a', 'C'), piece('b', 'S'), piece('c', 'C'), { itemId: 'o', kind: 'objet' as const, objet: 'pepite' as const, carteId: null, nom: null, rang: null }], jenny: 10 };
    expect(resumePart(p)).toBe('4 cartes · 1 S, 2 C, 1 objet · 10 J');
    expect(resumePart({ cartes: [], jenny: 80 })).toBe('80 J');
  });

  it('page ⑫ : fins dites en clair, selon qui et quand', () => {
    expect(messageFin('annule', 'Leolio', { parMoi: true })).toBe('Tu as annulé l’échange. Rien n’a bougé.');
    expect(messageFin('annule', 'Leolio')).toBe('Leolio a annulé l’échange. Rien n’a bougé.');
    expect(messageFin('refuse', 'Leolio')).toBe('Leolio a refusé ton échange.');
    expect(messageFin('expire', 'Leolio', { avant: 'invitation', invite: false })).toBe('Leolio n’a pas répondu à temps.');
    expect(messageFin('expire', 'Leolio', { avant: 'invitation', invite: true })).toMatch(/Tu n’as pas répondu à Leolio/);
    expect(messageFin('expire', 'Leolio', { avant: 'composition' })).toMatch(/3 minutes sans action/);
  });

  it('page ⑫ : vente, phrase de l’appel et contre-proposition', () => {
    const p = piece('x', 'S', 'La pierre flottante');
    expect(phraseVente('Leolio', p, 80)).toBe('Leolio te vend la pierre flottante pour 80 J.');
    const sonPart = { cartes: [p], jenny: 0 };
    expect(notePrix({ vente: { prix: 80, jeVends: false }, maPart: { cartes: [], jenny: 80 } })).toBe('Prix demandé : 80 J');
    expect(notePrix({ vente: { prix: 80, jeVends: false }, maPart: { cartes: [], jenny: 70 } })).toBe('Ta contre-proposition : 70 J (prix demandé 80 J)');
    expect(notePrix({ vente: null, maPart: sonPart })).toBeNull();
    expect(listePart({ cartes: [p, piece('d', 'D', 'Le dé du risque')], jenny: 20 })).toBe('la pierre flottante, le dé du risque et 20 J');
  });

  it('page ⑫ : cartes et objets proposables (pas les sorts), objet engagé ailleurs exclu', () => {
    const l = { ...livre, objets: [{ itemId: 'o1', objet: 'pepite' as const, obtenu: '', engage: false }, { itemId: 'o2', objet: 'voile' as const, obtenu: '', engage: true }] };
    const m = mesPieces(l, null);
    expect(m.map((x) => x.itemId)).toEqual(['a', 'o1']);
    expect(m[0]!.ou).toBe('emplacement 001');
    expect(m[1]!.vue).toMatchObject({ genre: 'objet', nom: 'Pépite d’or' });
  });

  it('page ⑫ : une carte jetée garde son angle', () => {
    expect(jete('abc')).toEqual(jete('abc'));
    expect(Math.abs(jete('abc').r)).toBeLessThanOrEqual(6);
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
