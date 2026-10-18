import { describe, expect, it } from 'vitest';
import { csv, csvContacts, csvParties, cumulerPublic, documentWord, nomFichier, type Statistiques } from './rapport';

const s: Statistiques = {
  partie: { id: 'KX7P2M', nom: 'Festival "Douala"', etat: 'terminee', creeLe: '2026-10-18T10:00:00Z', demarreeA: '2026-10-18T10:00:00Z', derniereActiviteA: null, dureeMin: 125, gagnant: 'Gon' },
  joueurs: { inscrits: 40, actifs: 30, inactifs: 2, abandons: 8, disqualifies: 0, tempsDeJeuMoyenMin: 52.5, actionsParJoueur: 31 },
  parHeure: [{ heure: Date.UTC(2026, 9, 18, 10), actions: 120, joueurs: 35, inscriptions: 40 }],
  scans: { reussis: 300, refuses: 12, parZone: [{ nom: 'Forêt <nord>', n: 300 }], balises: [] },
  activites: { sorts: 50, echanges: 12 },
  equipe: { gm: 10, pnj: 4 },
  classement: [{ place: 1, pseudo: 'Gon', cartes: 9, points: 30, jenny: 120 }],
  public: {
    fiches: 40,
    age: [{ id: '18-24', n: 25 }, { id: '15-17', n: 15 }],
    genre: [{ id: 'garcon', n: 22 }, { id: 'fille', n: 18 }],
    occupation: [],
    ville: [{ id: 'douala', n: 40 }],
    quartiers: [],
    reseaux: [{ id: 'tiktok', n: 30 }],
    source: [],
    numeros: 30,
    consentis: 21,
    revenus: 5,
  },
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

  it('RG-5.3 : qui est venu, en libellés et en parts ; cumul de plusieurs parties', () => {
    const doc = documentWord('Rapport', [s]);
    expect(doc).toContain('Qui est venu (40 fiches)');
    expect(doc).toContain('<td>18-24 ans</td><td>25</td><td>63 %</td>');
    const c = cumulerPublic([s.public, s.public]);
    expect(c).toMatchObject({ fiches: 80, consentis: 42, genre: [{ id: 'garcon', n: 44 }, { id: 'fille', n: 36 }] });
  });

  it('RG-5.3 : CSV des contacts avec libellés', () => {
    const l = csvContacts([{ telephone: '+237677123456', pseudo: 'Gon', age: '18-24', genre: 'fille', ville: 'douala', quartier: 'Akwa', derniere: 'Yorknew (KX7P2M)', parties: 2 }]).split('\r\n');
    expect(l[1]).toBe('+237677123456;Gon;18-24 ans;Fille;Douala;Akwa;Yorknew (KX7P2M);2');
  });

  it('nom de fichier sans accents ni espaces', () => {
    expect(nomFichier('Greed Island · Fête à Yaoundé')).toBe('greed-island-fete-a-yaounde');
  });
});
