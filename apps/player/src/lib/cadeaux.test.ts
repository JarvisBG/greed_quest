import { describe, expect, it } from 'vitest';
import { cadeauDe } from './cadeaux';

describe('cadeaux de l’équipe et expertise', () => {
  it('RG-3 correction du Book : la carte ajoutée jaillit, motif dans la boîte', () => {
    const c = cadeauDe('correction', { motif: 'Bug de scan', gains: [{ kind: 'carte', carteId: 'x', numero: 17, nom: 'Fruit', rang: 'B' }], retrait: null }, 1)!;
    expect(c.gains).toHaveLength(1);
    expect(c.texte).toContain('Motif : Bug de scan');
  });
  it('RG-3 correction de jenny : don = jenny qui jaillissent, retrait = boîte seule', () => {
    expect(cadeauDe('correction', { motif: 'x', jenny: 60, delta: 10 }, 1)!.gains).toEqual([{ kind: 'jenny', montant: 10 }]);
    expect(cadeauDe('correction', { motif: 'x', jenny: 40, delta: -10 }, 1)!.gains).toEqual([]);
  });
  it('RG-8.21 carte de Maître du jeu donnée par le GM : cinématique de la carte noire', () => {
    expect(cadeauDe('carte_gm_obtenue', { gm: 'jarvis', par: 'gm' }, 1)!.gains).toEqual([{ kind: 'gm', gm: 'jarvis' }]);
    expect(cadeauDe('carte_gm_obtenue', { gm: 'jarvis', par: 'raid' }, 1)).toBeNull();
  });
  it('RG-8.8 expertise : verdict en clair, page et coût', () => {
    expect(cadeauDe('expertise', { contrefacons: [], cout: 10, page: 2 }, 1)!.texte).toBe('Expertise de la page 2 (10 J) : aucune contrefaçon, tes cartes sont authentiques.');
    expect(cadeauDe('expertise', { contrefacons: ['a', 'b'], cout: 25, page: null }, 1)!.texte).toContain('2 contrefaçons démasquées');
  });
});
