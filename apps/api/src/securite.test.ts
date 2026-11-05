// Sécurité S3 (origines autorisées) et S4 (envois en rafale).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { DEBIT } from './auth/debit.js';
import { testApp } from './test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
beforeAll(async () => {
  t = await testApp({ debit: true });
  await t.setEtat('inscriptions', { inscriptionsOuvertes: true });
});
afterAll(async () => {
  await t.app.close();
  await t.close();
});

describe('Sécurité S4 : envois en rafale', () => {
  it('une session au-delà de la limite par minute est refusée en clair, puis repart la minute suivante', async () => {
    const gon = await t.inscrire('Gon');
    const lire = () => t.app.inject({ method: 'GET', url: `/parties/${t.partieId}/moi`, headers: t.bearer(gon.token) });
    t.clock.t += 60_000;
    for (let i = 0; i < DEBIT.parSessionMin; i++) expect((await lire()).statusCode).toBe(200);
    const trop = await lire();
    expect(trop.statusCode).toBe(429);
    expect(trop.json().message).toBe('Trop de demandes d’un coup : patiente quelques secondes');
    t.clock.t += 60_000;
    const apres = await lire();
    expect(apres.json()).toMatchObject({ ok: true });
  });

  it('sans session, compté par adresse : une autre adresse (autre téléphone) n’est pas gênée', async () => {
    t.clock.t += 60_000;
    const sante = (ip: string) => t.app.inject({ method: 'GET', url: `/parties/${t.partieId}`, headers: { 'x-gq-ip': ip } });
    for (let i = 0; i < DEBIT.parIpMin; i++) await sante('41.202.0.1');
    expect((await sante('41.202.0.1')).statusCode).toBe(429);
    expect((await sante('154.72.0.1')).statusCode).toBe(200);
  });
});

describe('Sécurité S3 : origines autorisées', () => {
  it('seules les apps Greed Island reçoivent l’autorisation CORS', async () => {
    const app = await buildApp({ db: t.db, corsOrigin: ['https://greed-island-joueur.exemple.dev'], realtime: false });
    const pre = (origin: string) =>
      app.inject({ method: 'OPTIONS', url: '/sante', headers: { origin, 'access-control-request-method': 'POST' } });
    expect((await pre('https://greed-island-joueur.exemple.dev')).headers['access-control-allow-origin']).toBe('https://greed-island-joueur.exemple.dev');
    expect((await pre('https://site-pirate.exemple.com')).headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });
});
