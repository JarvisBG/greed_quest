import { describe, expect, it } from 'vitest';
import { csv, csvParties, documentWord, nomFichier, type Statistiques } from './rapport';

const s: Statistiques = {
  partie: { id: 'KX7P2M', nom: 'Festival "Douala"', etat: 'terminee', creeLe: '2026-10-18T10:00:00Z', demarreeA: '2026-10-18T10:00:00Z', derniereActiviteA: null, dureeMin: 125, gagnant: 'Gon' },
  joueurs: { inscrits: 40, actifs: 30, inactifs: 2, abandons: 8, disqualifies: 0, tempsDeJeuMoyenMin: 52.5, actionsParJoueur: 31 },
  parHeure: [{ heure: Date.UTC(2026, 9, 18, 10), actions: 120, joueurs: 35, inscriptions: 40 }],
  scans: { reussis: 300, refuses: 12, parZone: [{ nom: 'Forêt <nord>', n: 300 }], balises: [] },
  activites: { sorts: 50, echanges: 12 },
  equipe: { gm: 10, pnj: 4 },
  classement: [{ place: 1, pseudo: 'Gon', cartes: 9, points: 30, jenny: 120 }],
};

describe('rapports', () => {
  it('CSV pour Excel en français : BOM, « ; », guillemets échappés', () => {
    expect(csv([['a;b', 'dit "oui"', 3]])).toBe('﻿"a;b";"dit ""oui""";3');
    const lignes = csvParties([s]).split('\r\n');
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toContain('KX7P2M;"Festival ""Douala"""');
  });

  it('rapport Word : chiffres de la partie, texte échappé', () => {
    const doc = documentWord('Rapport', [s]);
    expect(doc).toContain('Joueurs inscrits</td><td>40');
    expect(doc).toContain('Forêt &lt;nord&gt;');
    expect(doc).not.toContain('Synthèse');
    expect(documentWord('Rapport', [s, s])).toContain('Synthèse');
  });

  it('nom de fichier sans accents ni espaces', () => {
    expect(nomFichier('Greed Island · Fête à Yaoundé')).toBe('greed-island-fete-a-yaounde');
  });
});
