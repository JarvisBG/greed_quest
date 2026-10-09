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
});
afterAll(() => h.close());

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe('RG-3 rôles et authentification', () => {
  it('création de partie réservée au code organisateur', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/parties', payload: { nom: 'X', gm: { nom: 'a', code: '123456' } } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ ok: false, code: 'interdit' });
  });

  it('connexion de l’équipe par code', async () => {
    const ok = await app.inject({ method: 'POST', url: `/parties/${partieId}/staff/connexion`, payload: { code: 'secret-gm' } });
    expect(ok.json()).toMatchObject({ ok: true, role: 'gm', nom: 'Sivraj' });
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
