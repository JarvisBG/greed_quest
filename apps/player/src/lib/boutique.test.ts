import { describe, expect, it } from 'vitest';
import { boutonAchat, enListe, nbPieces, prixRachat, texteFiche, texteObtenu, type EtatBoutique } from './boutique';
import type { EmplacementCarte } from './livre';

const etat: EtatBoutique = {
  prixPaquet: 50,
  prixBase: 50,
  krachResteMs: null,
  paquetsRestants: 4,
  vagueResteMs: 801_000,
  mesAchats: 1,
  maxParVague: 2,
  revente: { D: 5, C: 10, B: 20, A: 40, S: 80, SS: null },
  reventeContrefacon: 1,
  reventeObjets: { pepite: 30, ticket: null, boussole: 10, souffle: 10, voile: 10, coffre: 10 },
};
const carte = (o: Partial<EmplacementCarte>): EmplacementCarte => ({
  etat: 'plein',
  kind: 'carte',
  designe: false,
  itemId: 'x',
  carteId: 'c',
  numero: 19,
  nom: 'L’oreiller',
  rang: 'B',
  apparence: 'normale',
  badge: null,
  provenance: '',
  obtenue: '',
  engagee: false,
  ...o,
});

describe('page ⑬ Masadora', () => {
  it('RG-9.4 : prix de rachat par rang, SS invendable', () => {
    expect(prixRachat(carte({ rang: 'B' }), etat)).toBe(20);
    expect(prixRachat(carte({ rang: 'SS' }), etat)).toBeNull();
  });

  it('RG-8.9 : une contrefaçon démasquée est reprise 1 J', () => {
    expect(prixRachat(carte({ rang: 'S', apparence: 'grisee' }), etat)).toBe(1);
    // Copie créée par le joueur (Mimétisme) : il la connaît, Masadora aussi.
    expect(prixRachat(carte({ rang: 'S', badge: 'contrefacon' }), etat)).toBe(1);
  });

  it('RG-9.2 / RG-9.3 : le bouton porte la raison du refus', () => {
    const b = (o: Partial<Omit<Parameters<typeof boutonAchat>[0], 'e'>> & { e?: Partial<EtatBoutique> } = {}) =>
      boutonAchat({ present: true, envoi: false, jenny: 120, vagueMs: 801_000, ...o, e: { ...etat, ...o.e } });
    expect(b()).toEqual({ texte: 'Acheter un paquet · 50 J', actif: true, qr: false });
    expect(b({ present: false })).toMatchObject({ texte: 'Scanner le QR de la boutique', actif: true, qr: true });
    expect(b({ e: { paquetsRestants: 0 } })).toMatchObject({ texte: 'Plus de paquets : vague suivante dans 13:21', actif: false });
    expect(b({ e: { mesAchats: 2 } }).texte).toBe('Tes 2 paquets de la vague : suivante dans 13:21');
    expect(b({ jenny: 30 }).texte).toBe('Il te manque 20 J');
    expect(b({ envoi: true })).toMatchObject({ texte: 'Envoi…', actif: false });
  });

  it('nomme ce qui est sorti du paquet', () => {
    expect(texteObtenu(['Vol', 'Gel', 'Vol'])).toBe('Tu as obtenu Vol ×2 et Gel.');
    expect(texteObtenu(['Vol', 'Gel', 'Trace'])).toBe('Tu as obtenu Vol, Gel et Trace.');
    expect(enListe(['Retour'])).toBe('Retour');
  });

  it('fiche de revente : où est la pièce', () => {
    expect(texteFiche({ objet: false, designe: true, numero: '019', prix: 20 })).toBe('Emplacement 019 de ton Book : il redeviendra vide. Masadora la reprend 20 J.');
    expect(texteFiche({ objet: false, prix: 10 })).toBe('Page libre. Masadora la reprend 10 J.');
    expect(texteFiche({ objet: true, prix: 30 })).toBe('Section Objets. Masadora le reprend 30 J.');
  });

  it('pièces qui tombent : 1 à 8', () => {
    expect(nbPieces(0)).toBe(1);
    expect(nbPieces(1)).toBe(2);
    expect(nbPieces(80)).toBe(8);
  });
});
