import { describe, expect, it } from 'vitest';
import { ECLATS, etapesDuTirage, indiceRangement, ongletDe, phraseGain, tamponDe, eclatDe } from './tirage';

describe('RG-8.3 : mise en scène du tirage reçu du serveur', () => {
  it('RG-8.3 : chaque gain devient une étape, dans l’ordre reçu (repli : jenny puis objet)', () => {
    const e = etapesDuTirage([
      { kind: 'jenny', montant: 30 },
      { kind: 'objet', objet: 'ticket' },
    ]);
    expect(e).toEqual([
      { type: 'jenny', montant: 30 },
      { type: 'carte', carte: { genre: 'objet', numero: '1032', nom: 'Loterie', rang: null, limite: null, texte: 'À gratter : 0, 10, 30 ou 100 J' } },
    ]);
  });

  it('RG-8.1 / RG-8.2 : carte désignée avec son numéro de l’anime, sa limite et son texte', () => {
    const [e] = etapesDuTirage([{ kind: 'carte', carteId: 'c1', nom: 'L’épée du vol', rang: 'A', numero: 94, texte: 'Une épée.', limite: 3 }]);
    expect(e).toEqual({ type: 'carte', carte: { genre: 'designee', numero: '094', nom: 'L’épée du vol', rang: 'A', limite: 3, texte: 'Une épée.' } });
    if (e?.type !== 'carte') throw new Error('carte attendue');
    expect(phraseGain(e.carte)).toBe('Tu obtiens la carte 094, L’épée du vol, rang A.');
    expect(tamponDe(e.carte)).toBe('A');
    expect(ongletDe(e.carte)).toBe('livre');
    expect(indiceRangement(e.carte)).toBe('Touche l’écran pour la ranger dans ton Book');
  });

  it('RG-8.3 : un sort se range avec les sorts, son tampon est « SORT »', () => {
    const [e] = etapesDuTirage([{ kind: 'sort', sort: 'analyse' }]);
    if (e?.type !== 'carte') throw new Error('carte attendue');
    expect(phraseGain(e.carte)).toBe('Tu obtiens le sort 1024, Pénétration.');
    expect(ongletDe(e.carte)).toBe('sorts');
    expect(tamponDe(e.carte)).toBe('SORT');
    expect(eclatDe(e.carte)).toBe(ECLATS.sort);
  });

  it('Second souffle : objet sans numéro de l’anime, et phrase quand il a servi au scan', () => {
    const [e] = etapesDuTirage([{ kind: 'objet', objet: 'souffle' }]);
    if (e?.type !== 'carte') throw new Error('carte attendue');
    expect(phraseGain(e.carte)).toBe('Tu obtiens l’objet Second souffle.');
    const [c] = etapesDuTirage([{ kind: 'carte', carteId: 'c2', nom: 'Maid panda', rang: 'S', numero: 99 }]);
    if (c?.type !== 'carte') throw new Error('carte attendue');
    expect(phraseGain(c.carte, true)).toBe('Second souffle utilisé. Tu obtiens la carte 099, Maid panda, rang S.');
  });

  it('RG-8.3 : plus le rang est haut, plus l’attente et l’éclat durent (D sans attente, SS le plus long)', () => {
    const ordre = (['D', 'C', 'B', 'A', 'S', 'SS'] as const).map((r) => ECLATS[r]);
    for (let i = 1; i < ordre.length; i++) {
      expect(ordre[i]!.attenteMs).toBeGreaterThan(ordre[i - 1]!.attenteMs);
      expect(ordre[i]!.etincelles).toBeGreaterThan(ordre[i - 1]!.etincelles);
    }
    expect(ECLATS.D.attenteMs).toBe(0);
    expect(ECLATS.SS.double).toBe(true);
  });
});
