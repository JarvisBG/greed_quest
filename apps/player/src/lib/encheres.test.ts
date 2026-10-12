import { describe, expect, it } from 'vitest';
import { boutonPalette, etatVignette, fusionnerLot, montantPalette, texteAdjuge, texteClotureAutre, texteSurencheri, type Lot } from './encheres';

const lot = (o: Partial<Lot> = {}): Lot => ({
  id: 'e1',
  carte: { id: 'c1', numero: 80, nom: 'La pierre flottante', rang: 'S', texte: null, limite: 2 },
  resteMs: 120_000,
  prixDepart: 10,
  meilleureOffre: { montant: 24, pseudo: 'Kirua', joueurId: 'k' },
  inscrit: true,
  maOffre: null,
  ...o,
});
const bouton = (l: Lot, o: Partial<Parameters<typeof boutonPalette>[0]> = {}) =>
  boutonPalette({ lot: l, moi: 'g', pas: 1, jenny: 120, present: false, envoi: false, resteMs: 60_000, ...o });

describe('page ⑭ Antokiba', () => {
  it('RG-11.4 : la palette propose +1 / +5 / +10 au-dessus de la meilleure offre, le prix de départ sans offre', () => {
    expect(montantPalette(lot(), 1)).toBe(25);
    expect(montantPalette(lot(), 10)).toBe(34);
    expect(montantPalette(lot({ meilleureOffre: null }), 10)).toBe(10);
  });

  it('RG-11.4 : le bouton dit pourquoi on ne peut pas lever la palette', () => {
    expect(bouton(lot())).toMatchObject({ texte: 'Lever la palette · 25 J', actif: true });
    expect(bouton(lot({ inscrit: false }))).toMatchObject({ qr: true, actif: true });
    // QR déjà scanné pendant la visite, ou visite à distance : on lève la palette directement.
    expect(bouton(lot({ inscrit: false }), { present: true })).toMatchObject({ qr: false, texte: 'Lever la palette · 25 J' });
    expect(bouton(lot({ meilleureOffre: { montant: 29, pseudo: 'Gon', joueurId: 'g' } }))).toMatchObject({ texte: 'Tu mènes à 29 J', actif: false });
    expect(bouton(lot({ meilleureOffre: { montant: 60, pseudo: 'Kirua', joueurId: 'k' } }), { jenny: 50 })).toMatchObject({ texte: 'Il te faudrait 61 J : tu en as 50', actif: false });
    expect(bouton(lot(), { pas: 10, jenny: 30 })).toMatchObject({ texte: '34 J, c’est plus que tes 30 J', actif: false });
    expect(bouton(lot(), { resteMs: 0 }).actif).toBe(false);
    expect(bouton(lot(), { envoi: true })).toMatchObject({ texte: 'La palette se lève…', actif: false });
  });

  it('vignettes : tu mènes, dépassé, ou le décompte', () => {
    expect(etatVignette(lot({ meilleureOffre: { montant: 29, pseudo: 'Gon', joueurId: 'g' } }), 'g', 1000).genre).toBe('mene');
    expect(etatVignette(lot({ maOffre: 20 }), 'g', 1000)).toEqual({ texte: 'dépassé', genre: 'depasse' });
    expect(etatVignette(lot(), 'g', 95_000)).toEqual({ texte: '1:35', genre: null });
  });

  it('un évènement public garde mon inscription et ma meilleure offre', () => {
    const avant = lot({ maOffre: 20 });
    const evt = { ...lot(), meilleureOffre: { montant: 30, pseudo: 'Kirua', joueurId: 'k' } };
    delete evt.inscrit;
    delete evt.maOffre;
    expect(fusionnerLot(avant, evt, 'g')).toMatchObject({ inscrit: true, maOffre: 20 });
    expect(fusionnerLot(undefined, { ...evt, meilleureOffre: { montant: 31, pseudo: 'Gon', joueurId: 'g' } }, 'g')).toMatchObject({ inscrit: true, maOffre: 31 });
    expect(fusionnerLot(undefined, evt, 'g')).toMatchObject({ inscrit: false, maOffre: null });
  });

  it('RG-11.4 / 11.5 : textes du jeu (surenchéri, adjugé à un autre, invendu, adjugé)', () => {
    expect(texteSurencheri('Kirua', 34, 'La pierre flottante', 155_000)).toBe('Kirua a surenchéri : 34 J sur la pierre flottante (2:35).');
    expect(texteClotureAutre({ id: 'e1', vendue: true, pseudo: 'Biscuit', prix: 19 }, 'La pierre flottante')).toBe('Adjugé à Biscuit pour 19 J. Tu ne paies rien.');
    expect(texteClotureAutre({ id: 'e1', vendue: false }, 'La pierre flottante')).toMatch(/retourne au stock du PNJ/);
    expect(texteAdjuge('La pierre flottante', 35)).toBe('Adjugé ! Tu as remporté la pierre flottante pour 35 J.');
  });
});
