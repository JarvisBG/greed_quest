import { describe, expect, it } from 'vitest';
import { exaequo, heureJeu, ordinal, podium, sousTitre, tailleNom, texteContrefacons, texteFerme, texteFin, type Classement, type LigneFin } from './fin';

const ligne = (place: number, pseudo: string, o: Partial<LigneFin> = {}): LigneFin => ({ place, pseudo, cartes: 10 - place, points: 30 - place, abandon: false, moi: false, ...o });
const base = (o: Partial<Classement> = {}): Classement => ({
  partieNom: 'Les plaines de Yorknew',
  designees: 14,
  termineeA: 6_000_000,
  gagnant: null,
  lignes: [ligne(1, 'Kirua'), ligne(2, 'Kurapika'), ligne(3, 'Biscuit'), ligne(4, 'Gon', { moi: true })],
  moi: { place: 4, cartes: 6, points: 26, jenny: 212, derniereCarteA: 6_060_000, contrefacons: 0, abandon: false },
  ...o,
});

describe('RG-13.5 classement final, page ⑱', () => {
  it('places : 1er, puis 2e, 3e…', () => {
    expect(ordinal(1)).toBe('1er');
    expect(ordinal(7)).toBe('7e');
  });

  it('ex æquo : même place pour plusieurs joueurs', () => {
    const l = [ligne(1, 'A'), ligne(1, 'B'), ligne(3, 'C')];
    expect(exaequo(l, 1)).toBe(true);
    expect(exaequo(l, 3)).toBe(false);
  });

  it('podium de gauche à droite : 2e, 1er, 3e ; moins de trois joueurs', () => {
    expect(podium(base().lignes).map((p) => [p.marche, p.ligne.pseudo])).toEqual([
      [2, 'Kurapika'],
      [1, 'Kirua'],
      [3, 'Biscuit'],
    ]);
    expect(podium([ligne(1, 'A'), ligne(2, 'B')]).map((p) => p.marche)).toEqual([2, 1]);
    expect(podium([ligne(1, 'A')]).map((p) => p.marche)).toEqual([1]);
  });

  it('heure de jeu en heures:minutes', () => {
    expect(heureJeu(6_060_000)).toBe('1:41');
    expect(heureJeu(0)).toBe('0:00');
  });

  it('sous-titre : comment la partie a fini, joueurs classés', () => {
    expect(sousTitre(base())).toBe('Les plaines de Yorknew · temps écoulé · 4 joueurs classés');
    expect(sousTitre(base({ gagnant: 'Kirua' }))).toBe('Les plaines de Yorknew · terminée par le Clear · 4 joueurs classés');
  });

  it('la voix du jeu : fin à l’heure ou par le Clear, puis ta place', () => {
    expect(texteFin(base(), 'Gon')).toBe('Le temps est écoulé : personne n’a réussi le Clear. Tu termines 4e sur 4.');
    expect(texteFin(base({ gagnant: 'Kirua' }), 'Gon')).toBe('Kirua a réussi le Clear. La partie est terminée. Tu termines 4e sur 4.');
    const premier = base({ moi: { ...base().moi!, place: 1 } });
    expect(texteFin(premier, 'Gon')).toBe('Le temps est écoulé : personne n’a réussi le Clear. Tu termines premier sur 4. Bravo, Hunter.');
  });

  it('RG-5.7 : après un abandon, tu restes classé', () => {
    const c = base({ moi: { ...base().moi!, abandon: true } });
    expect(texteFin(c, 'Gon')).toBe('Le temps est écoulé : personne n’a réussi le Clear. Tu avais quitté la partie, mais tu restes classé : 4e sur 4.');
  });

  it('RG-13.7 : la note des contrefaçons qui n’ont pas compté', () => {
    expect(texteContrefacons(0)).toBeNull();
    expect(texteContrefacons(1)).toMatch(/^Une contrefaçon de ton Book n’a pas compté/);
    expect(texteContrefacons(2)).toMatch(/^2 contrefaçons de ton Book n’ont pas compté/);
  });

  it('un nom long rapetisse pour tenir sur sa marche, sans passer sous 12 px', () => {
    expect(tailleNom('Gon', 130, 21)).toBe(21);
    expect(tailleNom('Tsezguerra', 130, 21)).toBeCloseTo(15.85, 1);
    expect(tailleNom('Unnomvraimenttrèstrèslong', 60, 21)).toBe(12);
  });

  it('RG-4.6 / RG-5.7 : refus d’agir en clair', () => {
    expect(texteFerme(true)).toBe('La partie est terminée : plus aucune action n’est possible.');
    expect(texteFerme(false)).toBe('Tu as quitté la partie : tu ne peux plus agir, seulement suivre.');
  });
});
