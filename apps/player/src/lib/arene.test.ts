import { describe, expect, it } from 'vitest';
import { minSecArene, pasDeLumiere, statutArene, texteAnnulee, texteDernier, texteEntree, texteVictoire, type EtatArene } from './arene';

const etat = (o: Partial<EtatArene> = {}): EtatArene => ({ mise: 30, delaiMin: 15, chances: { A: 50, S: 40, SS: 10 }, enCours: null, prochaineDansMs: 0, dernier: null, ...o });

describe('arène de Soufrabi côté joueur (amendement 2026-10-09, page ⑮)', () => {
  it('statut devant l’affiche : combat en cours, attente du délai, trop pauvre, prêt', () => {
    expect(statutArene(etat({ enCours: { id: 't', mise: 30, depuisMs: 0 } }), 100, 0)).toBe('combat');
    expect(statutArene(etat({ prochaineDansMs: 60_000 }), 100, 0)).toBe('attente');
    // Le délai s'écoule côté app : une fois passé, on est prêt.
    expect(statutArene(etat({ prochaineDansMs: 60_000 }), 100, 61_000)).toBe('pret');
    expect(statutArene(etat(), 18, 0)).toBe('pauvre');
    expect(statutArene(etat(), 30, 0)).toBe('pret');
  });

  it('phrases du jeu : entrée, annulation, victoire (carte ou repli en jenny), dernier combat', () => {
    expect(texteEntree(30)).toBe('Le PNJ a pris ta mise de 30 J. Que le combat commence !');
    expect(texteAnnulee(30, 'mauvais joueur scanné')).toBe('Le PNJ a annulé ton entrée (mauvais joueur scanné). Ta mise de 30 J t’est rendue.');
    expect(texteVictoire({ kind: 'carte', numero: 80, nom: 'La pierre flottante', rang: 'S', texte: null, limite: 2 })).toBe('Victoire ! L’arène te remet la pierre flottante, une carte S.');
    expect(texteVictoire({ kind: 'jenny', montant: 10, objet: 'pepite' })).toBe('Victoire ! L’arène n’a plus de carte A, S ou SS : elle te remet 10 J et Pépite d’or.');
    expect(texteDernier({ etat: 'perdue', ilYaMs: 0, rang: null, nom: null })).toBe('défaite');
    expect(texteDernier({ etat: 'gagnee', ilYaMs: 0, rang: 'SS', nom: 'X' })).toBe('victoire, une carte SS');
    expect(texteDernier(null)).toBeNull();
  });

  it('décompte et lumière des sceaux', () => {
    expect(minSecArene(15 * 60_000)).toBe('15:00');
    expect(minSecArene(-5)).toBe('0:00');
    expect(minSecArene(61_500)).toBe('1:02');
    // La lumière finit sur le bon sceau : pas % 3 = index du rang.
    expect(pasDeLumiere('A') % 3).toBe(0);
    expect(pasDeLumiere('S') % 3).toBe(1);
    expect(pasDeLumiere('SS') % 3).toBe(2);
  });
});
