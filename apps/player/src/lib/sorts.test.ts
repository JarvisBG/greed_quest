import { describe, expect, it } from 'vitest';
import type { LivreRecu } from './livre';
import { cartesUtilisables, corpsSort, criRecu, doublons, enPhrase, etapes, familles, ilYaRecu, issueLancer, issueRecu, pageDuSortRecu, pagesVision, pouvoirDispo, resumeSort, sortsDisponibles, texteSortRecu } from './sorts';

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
    // Page ⑨ : l'âge de la position (jamais la position elle-même, RG-10.12).
    expect(resumeSort({ sort: 'radar', resultat: 'reussi', zone: 'Forêt', ageMin: 3 }, 'Hisoka', nom)).toBe('Hisoka était dans la zone Forêt il y a 3 min.');
    expect(resumeSort({ sort: 'radar', resultat: 'reussi', zone: 'Forêt', ageMin: 0 }, 'Hisoka', nom)).toBe('Hisoka était dans la zone Forêt il y a moins d’une minute.');
    expect(resumeSort({ sort: 'radar', resultat: 'sans_effet', zone: null }, 'Hisoka', nom)).toBe('Position de Hisoka inconnue : aucune position reçue dans une zone.');
    expect(resumeSort({ sort: 'radar', resultat: 'bloque', protection: 'voile' }, 'Hisoka', nom)).toBe('Hisoka était protégé : sort bloqué par son Voile d’ombre.');
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
    // Page ⑨.
    expect(issueLancer({ sort: 'radar', resultat: 'reussi', zone: 'Forêt' })).toBe('ile');
    expect(issueLancer({ sort: 'radar', resultat: 'sans_effet', zone: null })).toBe('ile');
    expect(issueLancer({ sort: 'revelation', resultat: 'reussi', zone: null })).toBe('ile');
    expect(issueLancer({ sort: 'accompagnement', resultat: 'reussi' })).toBe('ile');
    expect(issueLancer({ sort: 'accompagnement', resultat: 'bloque', protection: 'barriere' })).toBe('mur');
    expect(issueLancer({ sort: 'analyse', resultat: 'reussi', contrefacons: [] })).toBe('penetration');
    expect(issueLancer({ sort: 'retour', resultat: 'reussi', ville: 'masadora' })).toBe('envol');
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

describe('page ⑪ : sort reçu (RG-10.5)', () => {
  const diamant = { kind: 'carte' as const, itemId: 'd', emplacement: 'fixe' as const, carteId: 'c79', numero: 79, nom: 'Le diamant arc-en-ciel', rang: 'C' as const, limite: 8 };
  const base = { lanceur: 'Kirua', resultat: 'reussi' as const };

  it('RG-10.5 : la cible apprend ce qu’elle perd, ce qu’elle reçoit et ce qui l’a protégée', () => {
    expect(texteSortRecu({ ...base, sort: 'vol', perdue: diamant })).toBe('Kirua t’a volé le diamant arc-en-ciel.');
    expect(texteSortRecu({ ...base, sort: 'vol', perdue: diamant, pouvoir: 'bandit' })).toBe('Kirua t’a volé le diamant arc-en-ciel avec L’épée du vol.');
    expect(texteSortRecu({ ...base, sort: 'pickpocket', perdue: { ...diamant, emplacement: 'libre' } })).toBe('Kirua t’a pris le diamant arc-en-ciel dans tes emplacements libres.');
    expect(texteSortRecu({ ...base, sort: 'pickpocket', perdue: { kind: 'sort', itemId: 's', emplacement: 'libre', sort: 'gel' } })).toBe('Kirua t’a pris la carte Gel dans tes emplacements libres.');
    expect(texteSortRecu({ ...base, sort: 'echange_force', perdue: diamant, recue: { ...diamant, itemId: 'o', nom: 'L’oreiller de l’esprit joueur' } })).toBe(
      'Kirua t’a imposé un échange : tu perds le diamant arc-en-ciel et tu reçois l’oreiller de l’esprit joueur.',
    );
    expect(texteSortRecu({ ...base, sort: 'vol', resultat: 'bloque', protection: 'barriere' })).toBe('Kirua t’a lancé Vol : ton Mur défensif l’a bloqué. Il est perdu.');
    expect(texteSortRecu({ ...base, sort: 'gel', resultat: 'bloque', protection: 'renforcement' })).toBe('Kirua t’a lancé Gel : ton aura de Renforcement l’a bloqué.');
    expect(texteSortRecu({ ...base, sort: 'radar', resultat: 'bloque', protection: 'voile' })).toBe('Kirua a voulu utiliser Trace sur toi : ton Voile d’ombre l’en a empêché. Il est perdu.');
    expect(texteSortRecu({ lanceur: null, sort: 'regard', resultat: 'bloque', protection: 'voile' })).toBe('Quelqu’un a voulu consulter ton Book : ton Voile d’ombre l’en a empêché. Il est perdu.');
    expect(texteSortRecu({ ...base, sort: 'pickpocket', resultat: 'sans_effet' })).toBe('Kirua t’a lancé Pickpocket, mais tes emplacements libres étaient vides.');
    expect(texteSortRecu({ ...base, sort: 'radar', resultat: 'sans_effet' })).toBe('Kirua a utilisé Trace sur toi, mais ne t’a pas trouvé.');
    // Ancienne forme de l'évènement (sans carte) : la phrase reste juste.
    expect(texteSortRecu({ ...base, sort: 'vol' })).toBe('Kirua t’a volé une carte !');
  });

  it('page ⑪ : cinématique pour les sorts qui frappent, boîte seule pour Trace et Voyance', () => {
    expect(issueRecu({ ...base, sort: 'vol', perdue: diamant })).toBe('vol');
    expect(issueRecu({ ...base, sort: 'pickpocket', perdue: diamant })).toBe('vol');
    expect(issueRecu({ ...base, sort: 'echange_force', perdue: diamant, recue: diamant })).toBe('echange');
    expect(issueRecu({ ...base, sort: 'gel' })).toBe('gel');
    expect(issueRecu({ ...base, sort: 'accompagnement' })).toBe('accompagnement');
    expect(issueRecu({ ...base, sort: 'vol', resultat: 'bloque', protection: 'barriere' })).toBe('mur');
    expect(issueRecu({ ...base, sort: 'vol', resultat: 'sans_effet' })).toBe('rien');
    expect(issueRecu({ ...base, sort: 'radar' })).toBe('boite');
    expect(issueRecu({ lanceur: null, sort: 'regard', resultat: 'reussi' })).toBe('boite');
    expect(criRecu({ ...base, sort: 'vol', pouvoir: 'bandit' })).toBe('L’épée du vol');
    expect(ilYaRecu(1_000_000, 1_000_000 + 6 * 60_000 + 5_000)).toBe('il y a 6 min');
  });

  it('page ⑪ : ta page d’avant le vol, la carte remise dans sa pochette', () => {
    const carte = (numero: number, itemId: string) => ({ etat: 'plein' as const, designe: true, kind: 'carte' as const, itemId, carteId: `c${numero}`, numero, nom: `C${numero}`, rang: 'C' as const, apparence: 'normale' as const, badge: null, provenance: '', obtenue: '', engagee: false });
    const livre: LivreRecu = {
      gele: false,
      cartesDesignees: 1,
      total: 3,
      libresUtilises: 1,
      pages: [
        [carte(78, 'a'), { etat: 'perdu', designe: true, carte: { numero: 79, nom: 'Le diamant arc-en-ciel', rang: 'C' }, message: 'Volée par Kirua' }, { etat: 'vide', designe: true, carte: { numero: 80, nom: 'P', rang: 'S' } }],
        [{ ...carte(12, 'o'), designe: false }, { etat: 'vide', designe: false }, { etat: 'vide', designe: false }],
      ],
      objets: [],
      placesObjets: 8,
    };
    const fixe = pageDuSortRecu(livre, diamant)!;
    expect(fixe).toMatchObject({ libre: false, index: 1, titre: '078 – 080' });
    expect(fixe.poches[1]).toMatchObject({ type: 'carte', carte: { numero: 79, nom: 'Le diamant arc-en-ciel' } });
    expect(fixe.poches[2]).toEqual({ type: 'absente', numero: 80, rang: 'S' });
    // Échange forcé dans les libres : la carte reçue (o) n'y était pas encore, la perdue reprend la première place libre.
    const libre = pageDuSortRecu(livre, { ...diamant, emplacement: 'libre' }, { ...diamant, itemId: 'o' })!;
    expect(libre).toMatchObject({ libre: true, index: 0, titre: 'Libres' });
    expect(libre.poches[0]).toMatchObject({ type: 'carte', carte: { nom: 'Le diamant arc-en-ciel' } });
  });
});
