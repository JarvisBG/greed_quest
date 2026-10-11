import { describe, expect, it } from 'vitest';
import type { LivreRecu } from './livre';
import { cartesUtilisables, corpsSort, doublons, enPhrase, etapes, familles, issueLancer, pagesVision, pouvoirDispo, resumeSort, sortsDisponibles, texteSortRecu } from './sorts';

const carte = (itemId: string, o: Partial<{ designe: boolean; engagee: boolean; apparence: 'normale' | 'grisee'; nom: string }> = {}) => ({
  etat: 'plein' as const,
  kind: 'carte' as const,
  itemId,
  carteId: `c-${itemId}`,
  numero: 1,
  nom: o.nom ?? itemId,
  rang: 'C' as const,
  designe: o.designe ?? true,
  engagee: o.engagee ?? false,
  apparence: o.apparence ?? 'normale',
  badge: null,
  provenance: 'Balise',
  obtenue: '14h05',
});
const sort = (itemId: string, s: 'vol' | 'barriere' | 'radar') => ({ etat: 'plein' as const, kind: 'sort' as const, designe: false, itemId, sort: s });

const livre: LivreRecu = {
  gele: false,
  cartesDesignees: 2,
  total: 30,
  libresUtilises: 5,
  objets: [],
  placesObjets: 8,
  pages: [
    [carte('a'), carte('b', { engagee: true }), { etat: 'vide', designe: true, carte: { numero: 3, nom: 'X', rang: 'B' } }],
    [sort('s1', 'barriere'), sort('s2', 'vol'), sort('s3', 'vol'), carte('d', { designe: false }), carte('g', { designe: false, apparence: 'grisee' }), sort('s4', 'radar')],
  ],
};

const ici = { lat: 1, lng: 2, precisionM: 5 };

describe('sorts côté app (RG-10)', () => {
  it('liste les sorts du Livre, regroupés, offensifs d’abord', () => {
    expect(sortsDisponibles(livre)).toEqual([
      { sort: 'vol', itemIds: ['s2', 's3'] },
      { sort: 'radar', itemIds: ['s4'] },
      { sort: 'barriere', itemIds: ['s1'] },
    ]);
  });

  it('cartes utilisables : ni engagées dans un échange, ni contrefaçons démasquées ; doublons = emplacements libres', () => {
    expect(cartesUtilisables(livre).map((c) => c.itemId)).toEqual(['a', 'd']);
    expect(doublons(livre).map((c) => c.itemId)).toEqual(['d']);
  });

  it('RG-5.4 amendé : pouvoir de Nen disponible quand sa recharge est finie', () => {
    expect(pouvoirDispo('emission', 0, 0, 'emission')).toBe(true);
    expect(pouvoirDispo('emission', 60_000, 10_000, 'emission')).toBe(false);
    expect(pouvoirDispo('emission', 60_000, 60_000, 'emission')).toBe(true);
    expect(pouvoirDispo('emission', null, 0, 'emission')).toBe(false);
    expect(pouvoirDispo('manipulation', 0, 0, 'emission')).toBe(false);
  });

  it('P1 : corps de l’intention selon le sort (schéma SortIntent)', () => {
    expect(corpsSort({ sort: 'vol', itemId: 's2', cibleId: 'k' }, ici)).toEqual({ sort: 'vol', source: { type: 'carte', itemId: 's2' }, cibleId: 'k', position: ici });
    expect(corpsSort({ sort: 'gel', itemId: 's', cibleId: 'k', emission: true }, ici)).toMatchObject({ emission: true });
    expect(corpsSort({ sort: 'echange_force', itemId: null, cibleId: 'k', carteItemId: 'a' }, ici)).toEqual({
      sort: 'echange_force',
      source: { type: 'pouvoir' },
      cibleId: 'k',
      carteDonneeId: 'a',
      position: ici,
    });
    expect(corpsSort({ sort: 'analyse', itemId: 's', page: 2 }, ici)).toEqual({ sort: 'analyse', itemId: 's', page: 2, position: ici });
    expect(corpsSort({ sort: 'revelation', itemId: 's' }, ici)).toEqual({ sort: 'revelation', itemId: 's', position: ici });
  });

  it('étapes du lancement', () => {
    expect(etapes('echange_force')).toEqual(['carte', 'cible']);
    expect(etapes('radar')).toEqual(['cible']);
    expect(etapes('analyse')).toEqual(['page']);
    expect(etapes('revelation')).toEqual([]);
  });

  it('résultats en clair pour le lanceur', () => {
    const nom = (id: string) => (id === 'a' ? 'Épée' : '?');
    expect(resumeSort({ sort: 'vol', resultat: 'reussi', recu: { itemId: 'x', nom: 'Couronne' } }, 'Kirua', nom)).toBe('Tu as volé Couronne à Kirua.');
    expect(resumeSort({ sort: 'vol', resultat: 'bloque', protection: 'barriere' }, 'Kirua', nom)).toBe('Kirua était protégé : sort bloqué par son Mur défensif.');
    expect(resumeSort({ sort: 'radar', resultat: 'reussi', zone: 'Forêt' }, 'Kirua', nom)).toBe('Dernière position connue de Kirua : zone Forêt.');
    expect(resumeSort({ sort: 'analyse', resultat: 'reussi', contrefacons: ['a'] }, null, nom)).toBe('Contrefaçon : Épée.');
    expect(resumeSort({ sort: 'duplication', resultat: 'reussi', copie: { itemId: 'c', carteId: 'x', contrefacon: true } }, null, nom)).toMatch(/contrefaçon/);
  });

  it('RG-10.5 : alerte reçue par la cible', () => {
    expect(texteSortRecu({ lanceur: 'Hisoka', sort: 'vol', resultat: 'reussi' })).toBe('Hisoka t’a volé une carte !');
    expect(texteSortRecu({ lanceur: 'Hisoka', sort: 'gel', resultat: 'bloque' })).toBe('Hisoka t’a lancé Gel, mais ta protection l’a bloqué.');
  });

  it('Regard (amendement 2026-10-09) : résultat listé, alerte anonyme, corps de la requête', () => {
    const cartes = [
      { carteId: 'a', numero: 1, nom: 'Couronne', rang: 'SS', n: 1, contrefacon: false },
      { carteId: 'b', numero: 4, nom: 'Boussole', rang: 'A', n: 2, contrefacon: true },
    ];
    expect(resumeSort({ sort: 'regard', resultat: 'reussi', cartes }, 'Kirua', () => '')).toBe('Cartes de Kirua : Couronne, Boussole ×2 (contrefaçon).');
    expect(texteSortRecu({ lanceur: null, sort: 'regard', resultat: 'reussi' })).toBe('Quelqu’un a consulté ton Book.');
    expect(corpsSort({ sort: 'regard', itemId: 'g', cibleId: 'k' }, { lat: 1, lng: 2, precisionM: 5 })).toEqual({ sort: 'regard', itemId: 'g', cibleId: 'k', position: { lat: 1, lng: 2, precisionM: 5 } });
    expect(etapes('regard')).toEqual(['cible']);
  });

  it('page ⑧ : la main en deux familles, offensifs d’abord (RG-10.3)', () => {
    const { offensifs, autres } = familles(sortsDisponibles(livre));
    expect(offensifs.map((d) => d.sort)).toEqual(['vol']);
    expect(autres.map((d) => d.sort)).toEqual(['radar', 'barriere']);
  });

  it('page ⑧ : l’article du nom passe en minuscule dans la phrase', () => {
    expect(enPhrase('Le diamant arc-en-ciel')).toBe('le diamant arc-en-ciel');
    expect(enPhrase("L'oreiller de l'esprit joueur")).toBe("l'oreiller de l'esprit joueur");
    expect(enPhrase('Les ciseaux coupe-liens')).toBe('les ciseaux coupe-liens');
    expect(enPhrase('Toraemon')).toBe('Toraemon');
    expect(enPhrase('Lettre')).toBe('Lettre');
    const r = { sort: 'echange_force' as const, resultat: 'reussi' as const, recu: { itemId: 'x', nom: "L'oreiller" } };
    expect(resumeSort(r, 'Kirua', () => '', 'Toraemon')).toBe("Échange forcé avec Kirua : tu lui donnes Toraemon et tu reçois l'oreiller.");
  });

  it('page ⑧ : ce que la comète rapporte selon la réponse du serveur', () => {
    expect(issueLancer({ sort: 'vol', resultat: 'reussi', recu: { itemId: 'x', nom: 'Couronne' } })).toBe('butin');
    expect(issueLancer({ sort: 'vol', resultat: 'sans_effet' })).toBe('texte');
    expect(issueLancer({ sort: 'pickpocket', resultat: 'bloque', protection: 'renforcement' })).toBe('mur');
    expect(issueLancer({ sort: 'gel', resultat: 'reussi' })).toBe('gel');
    expect(issueLancer({ sort: 'clairvoyance', resultat: 'reussi', cartes: [] })).toBe('vision');
    expect(issueLancer({ sort: 'duplication', resultat: 'reussi', copie: { itemId: 'c', carteId: 'x', contrefacon: false } })).toBe('copie');
    expect(issueLancer({ sort: 'radar', resultat: 'reussi', zone: 'Forêt' })).toBe('texte');
  });

  it('page ⑧ : la vision montre le Book de la cible par pages de 10', () => {
    const cartes = [
      { carteId: 'a', numero: 1, nom: 'Couronne', rang: 'SS', n: 1, contrefacon: false },
      { carteId: 'b', numero: 4, nom: 'Boussole', rang: 'A', n: 2, contrefacon: true },
    ];
    // Voyance : les 15 emplacements libres, cartes répétées selon leur nombre.
    const libres = pagesVision({ sort: 'regard', resultat: 'reussi', cartes }, livre, 15);
    expect(libres.map((p) => p.length)).toEqual([10, 5]);
    expect(libres[0]!.slice(0, 4).map((x) => x.type)).toEqual(['carte', 'carte', 'carte', 'vide']);
    // Clairvoyance : les emplacements fixes du catalogue ; une carte absente garde son numéro en creux.
    const fixes = pagesVision({ sort: 'clairvoyance', resultat: 'reussi', cartes: [{ carteId: 'z', numero: 3, nom: 'X', rang: 'B', n: 1, contrefacon: false }] }, livre, 15);
    expect(fixes).toEqual([
      [
        { type: 'absente', numero: 1, rang: 'C' },
        { type: 'absente', numero: 1, rang: 'C' },
        { type: 'carte', numero: 3, nom: 'X', rang: 'B', n: 1, contrefacon: false },
      ],
    ]);
  });
});
