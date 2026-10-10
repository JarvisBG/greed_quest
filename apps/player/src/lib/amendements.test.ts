// Amendements « fidélité à l'anime » du 2026-10-10 côté app joueur.
import { describe, expect, it } from 'vitest';
import { reperage, resteSuivi, type SuiviCible } from './accompagnement';
import { cartesACacher, titreDePage, type Emplacement, type LivreRecu } from './livre';
import { corpsSort, etapes, texteSortRecu } from './sorts';

const ici = { lat: 48.85, lng: 2.35 };
const suivi = (position: SuiviCible['position']): SuiviCible => ({ cibleId: 'k', pseudo: 'Kirua', position, resteMs: 180_000, recuA: 1_000 });

describe('Accompagnement : distance et direction de la cible', () => {
  it('RG-10 : « Kirua : 110 m au nord-est », « tout près », position inconnue', () => {
    const d = 0.0007; // ≈ 78 m vers le nord et ≈ 51 m vers l'est
    expect(reperage(ici, suivi({ lat: ici.lat + d, lng: ici.lng + d, precisionM: 5 }))).toMatch(/^Kirua : \d+ m au nord-est$/);
    expect(reperage(ici, suivi({ lat: ici.lat + 0.00003, lng: ici.lng, precisionM: 8 }))).toBe('Kirua est tout près');
    expect(reperage(ici, suivi(null))).toBe('Kirua : position pas encore connue');
    expect(reperage(null, suivi({ ...ici, precisionM: 5 }))).toBe('Kirua : active ta localisation pour le suivre');
  });

  it('temps restant décompté localement', () => {
    expect(resteSuivi(suivi(null), 61_000)).toBe(120_000);
    expect(resteSuivi(suivi(null), 999_999)).toBe(0);
  });
});

const fixe = (numero: number, plein = false): Emplacement =>
  plein
    ? { etat: 'plein', designe: true, kind: 'carte', itemId: `x${numero}`, carteId: `c${numero}`, apparence: 'normale', badge: null, provenance: 'Balise', obtenue: '14h00', engagee: false, numero, nom: `Carte ${numero}`, rang: 'C' }
    : { etat: 'vide', designe: true, carte: { numero, nom: `Carte ${numero}`, rang: 'C' } };
const livre = (pages: Emplacement[][], gele = false): LivreRecu => ({ gele, cartesDesignees: 1, total: 12, libresUtilises: 0, pages, objets: [], placesObjets: 8 });

describe('RG-8.1 / RG-8.5 amendés : Book', () => {
  const l = livre([[fixe(0, true), fixe(11), fixe(94)], [fixe(99)], [{ etat: 'vide', designe: false }], [{ etat: 'vide', designe: false }]]);

  it('RG-8.1 : titres de pages avec les numéros de l’anime, puis « Libres n »', () => {
    expect(titreDePage(l, 0)).toBe('000 – 094');
    expect(titreDePage(l, 1)).toBe('099');
    expect(titreDePage(l, 2)).toBe('Libres 1');
    expect(titreDePage(l, 3)).toBe('Libres 2');
  });

  it('RG-8.5 : seules les cartes en place se cachent, jamais sur un Book gelé', () => {
    expect(cartesACacher(l).map((c) => c.itemId)).toEqual(['x0']);
    expect(cartesACacher({ ...l, gele: true })).toEqual([]);
  });
});

describe('RG-10 amendé : intentions des nouveaux sorts', () => {
  const position = { ...ici, precisionM: 5 };
  it('RG-10 : Pickpocket, Clairvoyance, Accompagnement, Retour', () => {
    expect(corpsSort({ sort: 'pickpocket', itemId: 's', cibleId: 'k' }, position)).toEqual({ sort: 'pickpocket', itemId: 's', cibleId: 'k', position });
    expect(corpsSort({ sort: 'clairvoyance', itemId: 's', cibleId: 'k' }, position)).toEqual({ sort: 'clairvoyance', itemId: 's', cibleId: 'k', position });
    expect(corpsSort({ sort: 'accompagnement', itemId: 's', cibleId: 'k' }, position)).toEqual({ sort: 'accompagnement', itemId: 's', cibleId: 'k', position });
    expect(corpsSort({ sort: 'retour', itemId: 's', ville: 'masadora' }, position)).toEqual({ sort: 'retour', itemId: 's', ville: 'masadora', position });
    expect(etapes('retour')).toEqual(['ville']);
    expect(etapes('accompagnement')).toEqual(['cible']);
  });

  it('RG-10.5 : alertes reçues (Clairvoyance anonyme, Accompagnement nommé)', () => {
    expect(texteSortRecu({ lanceur: null, sort: 'clairvoyance', resultat: 'reussi' })).toBe('Quelqu’un a consulté ton Book.');
    expect(texteSortRecu({ lanceur: 'Gon', sort: 'accompagnement', resultat: 'reussi' })).toBe('Gon utilise Accompagnement sur toi : tu es gelé 3 min et il voit où tu es.');
  });
});
