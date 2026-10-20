import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculerStatistiques, type DonneesStat } from '../core/statistiques.js';
import { journal } from '../db/schema.js';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
let pnj: string;
beforeAll(async () => {
  t = await testApp();
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
  await t.setEtat('inscriptions', { inscriptionsOuvertes: true });
  await t.inscrire('Gon', undefined, { fiche: false });
  await t.inscrire('Kirua', undefined, { fiche: false });
});
afterAll(() => t.close());

const orga = { 'x-code-admin': 'orga' };

describe('Mes parties sur un nouvel appareil (code organisateur)', () => {
  it('liste toutes les parties avec leur nombre de joueurs', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/admin/parties', headers: orga });
    expect(res.json()).toMatchObject({ ok: true, parties: [{ id: t.partieId, etat: 'inscriptions', joueurs: 2 }] });
  });

  it('refusée sans le code organisateur', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/admin/parties', headers: { 'x-code-admin': 'faux' } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ ok: false, message: 'Code organisateur invalide' });
  });
});

describe('Statistiques et export (rapports)', () => {
  it('le GM lit les chiffres de sa partie', async () => {
    const s = (await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/statistiques`, headers: t.bearer(gm) })).json().statistiques;
    expect(s.joueurs).toMatchObject({ inscrits: 2, actifs: 2 });
    expect(s.parHeure.reduce((n: number, h: { inscriptions: number }) => n + h.inscriptions, 0)).toBe(2);
  });

  it('l’organisateur aussi, et pour toutes les parties ; un PNJ non', async () => {
    expect((await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/statistiques`, headers: orga })).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'GET', url: '/admin/statistiques', headers: orga })).json().parties).toHaveLength(1);
    expect((await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/statistiques`, headers: t.bearer(pnj) })).statusCode).toBe(403);
  });

  it('RG-10.12 : l’export du Journal ne contient aucune position', async () => {
    await t.db.insert(journal).values({ partieId: t.partieId, heureJeu: 60_000, acteurType: 'joueur', acteurId: null, action: 'scan', resultat: 'refus', details: { code: 'x', position: { lat: 1, lng: 2 } } });
    const lignes = (await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/journal/export`, headers: t.bearer(gm) })).json().lignes as { action: string; details: string }[];
    expect(lignes.some((l) => l.action === 'inscription')).toBe(true);
    expect(lignes.every((l) => !l.details.includes('lat'))).toBe(true);
  });
});

describe('calcul des statistiques', () => {
  const h = (min: number) => new Date(Date.UTC(2026, 9, 18, 14, min));
  const d: DonneesStat = {
    partie: { id: 'P', nom: 'Yorknew', etat: 'terminee', creeLe: h(0), demarreeA: h(0).getTime(), gagnantId: 'j1', classementFinal: [{ place: 1, pseudo: 'Gon', cartes: 3, points: 9, jenny: 40 }] },
    joueurs: [
      { id: 'j1', pseudo: 'Gon', statut: 'actif', creeLe: h(1) },
      { id: 'j2', pseudo: 'Kirua', statut: 'abandon', creeLe: h(2) },
    ],
    zones: [{ id: 'z1', nom: 'Forêt' }],
    balises: [{ id: 'b1', libelle: 'B-01', zoneId: 'z1' }],
    lignes: [
      { creeLe: h(10), acteurType: 'joueur', acteurId: 'j1', action: 'scan', resultat: 'ok', details: { baliseId: 'b1', zoneId: 'z1' } },
      { creeLe: h(30), acteurType: 'joueur', acteurId: 'j1', action: 'scan', resultat: 'ok', details: { baliseId: 'b1', zoneId: 'z1' } },
      { creeLe: h(40), acteurType: 'joueur', acteurId: 'j2', action: 'scan', resultat: 'refus', details: { code: 'trop_loin' } },
      { creeLe: h(50), acteurType: 'joueur', acteurId: 'j1', action: 'sort', resultat: 'ok', details: {} },
      { creeLe: h(55), acteurType: 'gm', acteurId: 'g', action: 'terminer', resultat: 'ok', details: {} },
    ],
  };
  const s = calculerStatistiques(d);

  it('joueurs, temps de jeu, heures', () => {
    expect(s.joueurs).toMatchObject({ inscrits: 2, actifs: 1, abandons: 1, tempsDeJeuMoyenMin: 20, actionsParJoueur: 2 });
    expect(s.parHeure).toEqual([{ heure: h(0).getTime(), actions: 4, joueurs: 2, inscriptions: 2 }]);
    expect(s.partie).toMatchObject({ dureeMin: 55, gagnant: 'Gon' });
  });

  it('scans par zone et par balise, activités, équipe, classement', () => {
    expect(s.scans).toEqual({ reussis: 2, refuses: 1, parZone: [{ nom: 'Forêt', n: 2 }], balises: [{ libelle: 'B-01', zone: 'Forêt', n: 2 }] });
    expect(s.activites.sorts).toBe(1);
    expect(s.equipe).toEqual({ gm: 1, pnj: 0 });
    expect(s.classement[0]).toMatchObject({ place: 1, pseudo: 'Gon' });
  });

  it('grosse partie (300 000 lignes de journal, positions comprises) : pas de plantage', () => {
    const lignes = Array.from({ length: 300_000 }, (_, i) => ({ creeLe: h(i % 120), acteurType: 'joueur', acteurId: `j${i % 80}`, action: 'position', resultat: 'ok', details: null }));
    expect(() => calculerStatistiques({ ...d, lignes })).not.toThrow();
  });
});

describe('RG-5.3 Fiche Hunter (collecte de profil)', () => {
  const fiche = { age: '18-24', genre: 'fille', occupation: 'etudiant', ville: 'douala', quartier: 'Akwa', reseaux: ['tiktok', 'whatsapp'], source: 'ami' };
  let gon: string;
  let kurapika: string;
  beforeAll(async () => {
    gon = (await t.inscrire('Gon2', undefined, { fiche: false })).token;
    kurapika = (await t.inscrire('Kurapika', undefined, { fiche: false })).token;
  });

  it('RG-5.3 : sans fiche, aucune action de jeu (scan refusé) ; le test de Nen reste permis', async () => {
    const scan = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/scan`, headers: t.bearer(gon), payload: { baliseId: 'x', position: { lat: 1, lng: 1, precisionM: 5 } } });
    expect(scan.statusCode).toBe(403);
    expect(scan.json()).toMatchObject({ ok: false, code: 'fiche_requise', message: 'Remplis d’abord ta fiche Hunter' });
    const nen = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/nen`, headers: t.bearer(gon), payload: { reponses: [] } });
    expect(nen.json().code).not.toBe('fiche_requise');
  });

  it('RG-5.3 : toutes les réponses obligatoires, téléphone camerounais vérifié', async () => {
    const res = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/fiche`, headers: t.bearer(gon), payload: { ...fiche, telephone: '12345' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Numéro WhatsApp camerounais invalide');
  });

  it('RG-5.3 : fiche remplie = 30 J, une seule fois ; le téléphone n’entre pas dans le Journal', async () => {
    const res = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/fiche`, headers: t.bearer(gon), payload: { ...fiche, telephone: '6 77 12 34 56', accordRecontact: true } });
    expect(res.json()).toMatchObject({ ok: true, bonus: 30 });
    const encore = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/fiche`, headers: t.bearer(gon), payload: { ...fiche, telephone: '677123456' } });
    expect(encore.json()).toMatchObject({ ok: false, code: 'deja_fait' });
    const lignes = (await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/journal/export`, headers: t.bearer(gm) })).json().lignes as { details: string }[];
    expect(lignes.every((l) => !l.details.includes('677'))).toBe(true);
  });

  it('RG-5.3 : moins de 15 ans, pas de téléphone ; accord de recontact libre', async () => {
    const res = await t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/fiche`, headers: t.bearer(kurapika), payload: { ...fiche, age: 'moins15', genre: 'garcon', quartier: 'AKWÁ', telephone: '699000000', accordRecontact: true } });
    expect(res.json()).toMatchObject({ ok: true });
    const s = (await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/statistiques`, headers: t.bearer(gm) })).json().statistiques;
    expect(s.public).toMatchObject({ fiches: 2, numeros: 1, consentis: 1, revenus: 0, quartiers: [{ id: 'akwa', n: 2 }] });
    expect(s.public.genre).toEqual(expect.arrayContaining([{ id: 'fille', n: 1 }, { id: 'garcon', n: 1 }]));
    expect(s.public.reseaux).toEqual(expect.arrayContaining([{ id: 'tiktok', n: 2 }]));
  });

  it('RG-5.3 : contacts consentis exportés par le GM et l’organisateur, pas par un PNJ', async () => {
    const c = (await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/contacts`, headers: t.bearer(gm) })).json().contacts;
    expect(c).toEqual([expect.objectContaining({ telephone: '+237677123456', pseudo: 'Gon2', parties: 1 })]);
    expect((await t.app.inject({ method: 'GET', url: '/admin/contacts', headers: orga })).json().contacts).toHaveLength(1);
    expect((await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/contacts`, headers: t.bearer(pnj) })).statusCode).toBe(403);
  });

  it('RG-5.3 : le numéro n’est jamais renvoyé au joueur', async () => {
    const moi = await t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/moi`, headers: t.bearer(gon) });
    expect(JSON.stringify(moi.json())).not.toContain('677123456');
    expect(moi.json().joueur).toMatchObject({ ficheFaite: true });
  });
});
