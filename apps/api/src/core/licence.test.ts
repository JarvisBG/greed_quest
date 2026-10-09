import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testApp } from '../test/helpers.js';
import { LICENCE_PERIOD_MS, licenceCode } from './licence.js';

let t: Awaited<ReturnType<typeof testApp>>;
let joueur: { token: string; id: string };
let pnj: string;
beforeAll(async () => {
  t = await testApp();
  await t.setEtat('inscriptions', { inscriptionsOuvertes: true });
  joueur = await t.inscrire('Gon');
  // Jeton PNJ signé directement (la connexion de l'équipe est testée dans staff.test.ts).
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
});
afterAll(() => t.close());

const verifier = (qr: string, token = pnj) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/licence/verifier`, headers: t.bearer(token), payload: { qr } });

describe('RG-5.2 licence QR tournante', () => {
  it('le PNJ scanne la licence courante et identifie le joueur', async () => {
    const lic = await t.app.inject({ url: `/parties/${t.partieId}/licence`, headers: t.bearer(joueur.token) });
    const { qr, expireA } = lic.json();
    expect(expireA - t.clock.t).toBeLessThanOrEqual(LICENCE_PERIOD_MS);
    expect((await verifier(qr)).json()).toMatchObject({ ok: true, joueur: { id: joueur.id, pseudo: 'Gon' } });
  });

  it('calculable hors ligne avec le secret reçu par /moi', async () => {
    const moi = await t.app.inject({ url: `/parties/${t.partieId}/moi`, headers: t.bearer(joueur.token) });
    const { qr } = licenceCode(joueur.id, moi.json().licenceSecret, t.clock.t);
    expect((await verifier(qr)).json().ok).toBe(true);
  });

  it('renouvelée toutes les 30 s : une ancienne licence expire', async () => {
    const { qr } = (await t.app.inject({ url: `/parties/${t.partieId}/licence`, headers: t.bearer(joueur.token) })).json();
    t.clock.t += 2 * LICENCE_PERIOD_MS + 1;
    expect((await verifier(qr)).json()).toMatchObject({ ok: false, code: 'licence_expiree' });
  });

  it('licence falsifiée refusée ; vérification réservée à l’équipe', async () => {
    const { qr } = (await t.app.inject({ url: `/parties/${t.partieId}/licence`, headers: t.bearer(joueur.token) })).json();
    expect((await verifier(qr.slice(0, -2) + 'AA')).json()).toMatchObject({ ok: false, code: 'licence_invalide' });
    expect((await verifier(qr, joueur.token)).statusCode).toBe(403);
  });
});
