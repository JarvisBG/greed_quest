import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { openDb, type DbHandle } from '../db/client.js';
import { seedPresets } from '../db/seed.js';

let h: DbHandle;
let app: FastifyInstance;
let partieId: string;
let gm: string;
beforeAll(async () => {
  h = await openDb();
  await seedPresets(h.db);
  app = await buildApp({ db: h.db, adminCode: 'orga' });
  const res = await app.inject({
    method: 'POST',
    url: '/admin/parties',
    headers: { 'x-code-admin': 'orga' },
    payload: { nom: 'Test', demo: true, gm: { nom: 'Sivraj', code: 'secret-gm' } },
  });
  ({ partieId, token: gm } = res.json());
  expect(partieId).toMatch(/^[A-HJ-NP-Z2-9]{6}$/); // code court à taper ou à dicter
});
afterAll(() => h.close());

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe('CORS (fronts sur une autre adresse)', () => {
  it('autorise PUT et PATCH depuis une autre origine (catalogue, paramètres)', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/admin/parties',
      headers: { origin: 'https://console.exemple', 'access-control-request-method': 'PUT' },
    });
    expect(res.headers['access-control-allow-methods']).toContain('PUT');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
  });
});

describe('RG-3 rôles et authentification', () => {
  it('création de partie réservée au code organisateur', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/parties', payload: { nom: 'X', gm: { nom: 'a', code: '123456' } } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ ok: false, code: 'interdit' });
  });

  it('RG-8.1 (amendement 2026-10-17) : sans démo, la partie naît avec un catalogue tiré au hasard, N conseillé', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/parties',
      headers: { 'x-code-admin': 'orga' },
      payload: { nom: 'Neuve', joueursAttendus: 80, gm: { nom: 'G', code: 'code-neuve' } },
    });
    const { partieId: id, token } = res.json();
    const cs = (await app.inject({ method: 'GET', url: `/parties/${id}/cartes` })).json().cartes as { rang: string }[];
    // 120 min (Standard) et 80 joueurs : 16 cartes conseillées, 1 SS.
    expect(cs).toHaveLength(16);
    expect(cs.filter((c) => c.rang === 'SS')).toHaveLength(1);
    const ps = (await app.inject({ method: 'GET', url: `/parties/${id}/parametres`, headers: bearer(token) })).json().parametres as { key: string; applied: number }[];
    expect(ps.find((p) => p.key === 'cartesDesignees')?.applied).toBe(16);
  });

  it('connexion de l’équipe par code', async () => {
    const ok = await app.inject({ method: 'POST', url: `/parties/${partieId}/staff/connexion`, payload: { code: 'secret-gm' } });
    expect(ok.json()).toMatchObject({ ok: true, id: expect.any(String), role: 'gm', nom: 'Sivraj' });
    const ko = await app.inject({ method: 'POST', url: `/parties/${partieId}/staff/connexion`, payload: { code: 'mauvais' } });
    expect(ko.statusCode).toBe(401);
    expect(ko.json().message).toBe('Code invalide');
  });

  it('RG-3.2 : un GM ajoute un PNJ ; le PNJ ne peut pas ajouter de membre', async () => {
    const add = await app.inject({
      method: 'POST',
      url: `/parties/${partieId}/staff`,
      headers: bearer(gm),
      payload: { nom: 'Arbitre 1', role: 'pnj', code: 'pnj-code' },
    });
    expect(add.json()).toMatchObject({ ok: true });
    const login = await app.inject({ method: 'POST', url: `/parties/${partieId}/staff/connexion`, payload: { code: 'pnj-code' } });
    const pnj = login.json().token as string;
    const refus = await app.inject({
      method: 'POST',
      url: `/parties/${partieId}/staff`,
      headers: bearer(pnj),
      payload: { nom: 'Pirate', role: 'gm', code: 'pirate-code' },
    });
    expect(refus.statusCode).toBe(403);
  });

  it('RG-3.1 : journal lisible par l’équipe, avec l’auteur de chaque action', async () => {
    const res = await app.inject({ url: `/parties/${partieId}/journal`, headers: bearer(gm) });
    const actions = res.json().lignes.map((l: { action: string; acteurType: string }) => `${l.acteurType}:${l.action}`);
    expect(actions).toEqual(['gm:ajout_staff', 'systeme:creation_partie']);
  });

  it('sans jeton, jeton falsifié ou d’une autre partie : refusé', async () => {
    expect((await app.inject({ url: `/parties/${partieId}/journal` })).statusCode).toBe(401);
    expect((await app.inject({ url: `/parties/${partieId}/journal`, headers: bearer(gm + 'x') })).statusCode).toBe(401);
    expect((await app.inject({ url: `/parties/autre/journal`, headers: bearer(gm) })).statusCode).toBe(403);
  });

  it('requête invalide : motif en clair', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/parties/${partieId}/staff`,
      headers: bearer(gm),
      payload: { nom: 'P', role: 'pnj', code: '123' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('code : Code d’au moins 6 caractères');
  });
});
