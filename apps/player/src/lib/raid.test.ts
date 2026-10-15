import { describe, expect, it } from 'vitest';
import { BOSS_BASE, bossDe, coupsDe, enCombat, fusionnerCoup, mmss, questionSuivante, texteEquipe, texteFuite, texteVictoireSansCoup, type VueRaid } from './raid';

const vue: VueRaid = { id: 'r1', pv: 40, pvMax: 60, resteMs: 300_000, frappeurs: 5, reponses: { q1: true, q2: false }, recuA: 0 };

describe('RG-12 raid, page ⑯', () => {
  it('un coup reçu en direct baisse la barre et garde mes réponses', () => {
    const v = fusionnerCoup(vue, { id: 'r1', pv: 39, pvMax: 60, par: { id: 'j2', pseudo: 'Kirua' }, frappeurs: 6, resteMs: 290_000 }, 1000);
    expect(v).toMatchObject({ pv: 39, frappeurs: 6, resteMs: 290_000, recuA: 1000, reponses: { q1: true, q2: false } });
  });

  it('un évènement en retard ne fait pas remonter les PV', () => {
    const v = fusionnerCoup(vue, { id: 'r1', pv: 42, pvMax: 60, par: null, frappeurs: 4, resteMs: 299_000 }, 1000);
    expect(v.pv).toBe(40);
    expect(v.frappeurs).toBe(5);
  });

  it('un autre raid repart de zéro', () => {
    const v = fusionnerCoup(vue, { id: 'r2', pv: 60, pvMax: 60, par: null, frappeurs: 0, resteMs: 600_000 }, 0);
    expect(v.reponses).toEqual({});
    expect(v.pv).toBe(60);
  });

  it('combat en cours tant qu’il reste des PV et du temps', () => {
    expect(enCombat(vue, 100_000)).toBe(true);
    expect(enCombat(vue, 300_000)).toBe(false);
    expect(enCombat({ ...vue, pv: 0 }, 0)).toBe(false);
    expect(enCombat(null, 0)).toBe(false);
  });

  it('mes coups et la question suivante', () => {
    expect(coupsDe(vue.reponses)).toBe(1);
    const qs = ['q1', 'q2', 'q3'].map((id) => ({ id, texte: id, choix: ['a', 'b'] }));
    expect(questionSuivante(qs, vue.reponses)?.id).toBe('q3');
    expect(questionSuivante(qs, { ...vue.reponses, q3: true })).toBeNull();
  });

  it('textes en clair', () => {
    expect(mmss(462_000)).toBe('7:42');
    expect(mmss(-5)).toBe('0:00');
    expect(texteEquipe(0)).toBe('Personne n’a encore frappé');
    expect(texteEquipe(1)).toBe('1 joueur a frappé');
    expect(texteEquipe(8)).toBe('8 joueurs ont frappé');
    expect(texteFuite(BOSS_BASE, 23)).toBe('Le temps est écoulé : la Brigade s’est enfuie avec 23 PV. Pas de récompense cette fois.');
    expect(texteVictoireSansCoup(BOSS_BASE)).toBe('La Brigade est tombée sans toi : pas de coup porté, pas de paquet cette fois.');
  });

  it('boss inconnu : le boss de base', () => {
    expect(bossDe('inconnu')).toBe(BOSS_BASE);
    expect(bossDe(null)).toBe(BOSS_BASE);
  });
});
