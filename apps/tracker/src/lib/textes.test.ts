import { describe, expect, it } from 'vitest';
import { chrono, depassement, estCarteRare, etiquette, fait, ligneAnnonce, mmss, titreDuel } from './textes';
import type { LigneClassement } from './types';

const l = (pseudo: string, cartes: number, points = cartes * 5, place = 0): LigneClassement => ({ pseudo, cartes, points, place });

describe('Fil de l’écran géant (RG-10.6)', () => {
  it('tirage : la carte illustrée, son rang ; S et SS en cinématique', () => {
    const e = { type: 'tirage' as const, pseudo: 'Kirua', carte: 'Blue planet', rang: 'S' as const, numero: 81, limite: 2, texte: 'Un joyau', heureJeu: 0 };
    expect(fait(e)).toMatchObject({ texte: 'Kirua a tiré « Blue planet »', rang: 'S', carte: { numero: 81, nom: 'Blue planet' } });
    expect(ligneAnnonce(e)).toBe('Kirua a tiré « Blue planet » · rang S');
    expect(estCarteRare(e)).toBe(true);
    expect(estCarteRare({ ...e, rang: 'A' })).toBe(false);
  });

  it('sort : lanceur, cible et résultat ; Voyance anonyme (amendement 2026-10-09)', () => {
    expect(fait({ type: 'sort', lanceur: 'Hisoka', cible: 'Gon', sort: 'vol', resultat: 'reussi', heureJeu: 0 })).toMatchObject({ texte: 'Hisoka a lancé Vol sur Gon : réussi', mot: 'VOL !' });
    expect(fait({ type: 'sort', lanceur: null, cible: null, sort: 'regard', resultat: 'reussi', heureJeu: 0 })).toMatchObject({ texte: "Quelqu'un a utilisé Voyance", mot: 'VOYANCE' });
  });

  it('RG-8.15 : cartes de Maître du jeu (Jarvis, Sceau, trouvée au scan) en filet d’or', () => {
    expect(fait({ type: 'carte_gm', gm: 'jarvis', lanceur: 'Gon', carte: 'Blue planet', figes: [], reprisA: null, heureJeu: 0 })).toMatchObject({ gm: true, mot: 'JARVIS' });
    expect(fait({ type: 'carte_gm', gm: 'ange', lanceur: 'Leolio', cible: 'Kurapika', heureJeu: 0 }).texte).toBe('Leolio a scellé le Book de Kurapika');
    expect(fait({ type: 'carte_gm', gm: 'ange', pseudo: 'Leolio', heureJeu: 0 }).texte).toBe('Leolio a trouvé une carte de Maître du jeu');
  });

  it('échange et fin de raid', () => {
    expect(fait({ type: 'echange', joueurs: ['Biscuit', 'Leolio'], heureJeu: 0 }).texte).toBe('Échange de cartes rares entre Biscuit et Leolio');
    expect(fait({ type: 'raid', reussi: true, frappeurs: 1, heureJeu: 0 }).texte).toBe('La Brigade est vaincue : 1 Hunter récompensé');
  });
});

describe('Habillage', () => {
  it('chrono et minutes', () => {
    expect(chrono((84 * 60 + 10) * 1000)).toBe('1:24:10');
    expect(chrono(572_000)).toBe('09:32');
    expect(mmss(61_500)).toBe('01:02');
  });
  it('RG-12 : étiquettes des évènements, carte maudite en noir', () => {
    expect(etiquette({ type: 'double_gain' })).toEqual({ titre: 'Double gain', maudite: false });
    expect(etiquette({ type: 'carte_maudite' }).maudite).toBe(true);
  });
});

describe('Course au Book (RG-13)', () => {
  it('dépassement : celui qui gagne des places, et la prise de tête', () => {
    const avant = [l('Kirua', 22), l('Gon', 21), l('Biscuit', 19)];
    expect(depassement(avant, [l('Kirua', 22), l('Gon', 21), l('Biscuit', 22, 200)])).toEqual({ pseudo: 'Biscuit', tete: true });
    expect(depassement(avant, [l('Kirua', 22), l('Gon', 18), l('Biscuit', 19)])).toEqual({ pseudo: 'Biscuit', tete: false });
    expect(depassement(avant, avant)).toBeNull();
  });
  it('titre du duel selon l’écart', () => {
    expect(titreDuel(l('Kirua', 22), l('Gon', 22))).toBe('À égalité !');
    expect(titreDuel(l('Kirua', 22), l('Gon', 21))).toBe('Au coude à coude');
    expect(titreDuel(l('Kirua', 24), l('Gon', 21))).toBe('Kirua mène la course');
    expect(titreDuel(l('Kirua', 26), l('Gon', 21))).toBe("Kirua s'envole");
  });
});
