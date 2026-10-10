import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, joueurs, sorts } from '../db/schema.js';
import { licenceCode } from '../core/licence.js';
import { SYSTEME } from '../core/journal.js';
import { tickPartie } from '../core/taches.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let gm: string;
let pnj: string;
type J = { token: string; id: string };
let gon: J, kirua: J, leorio: J;
const ici = { ...CENTRE, precisionM: 5 };

beforeAll(async () => {
  t = await testApp();
  gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  leorio = await t.inscrire('Leorio');
});
afterAll(() => t.close());

const post = (url: string, token: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), payload });
const joueur = async (id: string) => (await t.db.select().from(joueurs).where(eq(joueurs.id, id)))[0]!;
const licence = async (j: J) => licenceCode(j.id, (await joueur(j.id)).licenceSecret, t.clock.t).qr;
async function donnerCarte(joueurId: string, numero: number, origine: object = { type: 'kit' }, faux?: object) {
  const id = newId();
  await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId, carteId: t.carteIds[numero - 1]!, origine: origine as never, obtenuA: 0, ...(faux ? { faux: faux as never } : {}) });
  return id;
}

describe('Console de l’équipe', () => {
  it('RG-10.12 : liste des joueurs pour l’équipe, sans position ; refusée aux joueurs', async () => {
    const res = await t.app.inject({ url: `/parties/${t.partieId}/joueurs`, headers: t.bearer(pnj) });
    expect(res.json().joueurs.map((j: { pseudo: string }) => j.pseudo)).toEqual(['Gon', 'Kirua', 'Leorio']);
    expect(res.json().joueurs[0]).toMatchObject({ id: gon.id, statut: 'actif' });
    expect(res.json().joueurs[0]).not.toHaveProperty('position');
    expect((await t.app.inject({ url: `/parties/${t.partieId}/joueurs`, headers: t.bearer(gon.token) })).statusCode).toBe(403);
  });
});

describe('RG-3 / RG-15 sanctions', () => {
  it('RG-3.1 : motif obligatoire', async () => {
    const res = await post('/sanctions/avertissement', pnj, { joueurId: gon.id, motif: '' });
    expect(res.json()).toMatchObject({ ok: false, message: 'motif : Motif obligatoire' });
  });

  it('PNJ : gel 5 min ; le joueur ne peut plus scanner ; dégel automatique', async () => {
    expect((await post('/sanctions/gel', pnj, { joueurId: gon.id, motif: 'Sortie de zone' })).json().ok).toBe(true);
    const scan = await post('/scan', gon.token, { baliseId: t.baliseIds[0], position: ici });
    expect(scan.json()).toMatchObject({ code: 'joueur_gele' });
    t.clock.t += 5 * 60_000;
    await t.app.gq.runner.run(t.partieId, SYSTEME, tickPartie);
    expect((await joueur(gon.id)).statut).toBe('actif');
  });

  it('RG-15 photo de balise : gains de la balise annulés + gel', async () => {
    const carte = await donnerCarte(kirua.id, 30, { type: 'balise', baliseId: 'B-photo' });
    await donnerCarte(kirua.id, 29);
    const res = await post('/sanctions/annulation-gains', pnj, { joueurId: kirua.id, baliseId: 'B-photo', motif: 'Photo de balise partagée' });
    expect(res.json()).toMatchObject({ ok: true, retirees: 1 });
    expect(await t.db.select().from(exemplaires).where(eq(exemplaires.id, carte))).toEqual([]);
    expect((await joueur(kirua.id)).statut).toBe('gele');
  });

  it('RG-3 / RG-15.2 : disqualification par le GM seulement ; le Book est perdu', async () => {
    await donnerCarte(leorio.id, 1);
    expect((await post('/sanctions/disqualification', pnj, { joueurId: leorio.id, motif: 'Faux GPS' })).statusCode).toBe(403);
    expect((await post('/sanctions/disqualification', gm, { joueurId: leorio.id, motif: 'Faux GPS' })).json().ok).toBe(true);
    expect(await t.db.select().from(exemplaires).where(eq(exemplaires.joueurId, leorio.id))).toEqual([]);
    expect((await t.db.select().from(sorts).where(eq(sorts.joueurId, leorio.id))).every((s) => s.utilise)).toBe(true);
    expect((await joueur(leorio.id)).statut).toBe('disqualifie');
  });
});

describe('corrections du GM', () => {
  it('ajout d’une carte et correction de jenny, motivées', async () => {
    expect((await post('/corrections/livre', gm, { joueurId: gon.id, ajouterCarteId: t.carteIds[10], motif: 'Carte perdue par bug' })).json().ok).toBe(true);
    const cartes = await t.db.select().from(exemplaires).where(eq(exemplaires.joueurId, gon.id));
    expect(cartes.some((x) => x.carteId === t.carteIds[10] && x.origine.type === 'correction_gm')).toBe(true);
    expect((await post('/corrections/jenny', gm, { joueurId: gon.id, delta: 15, motif: 'Remboursement' })).json()).toMatchObject({ ok: true, jenny: 65 });
    expect((await post('/corrections/jenny', pnj, { joueurId: gon.id, delta: 15, motif: 'Remboursement' })).statusCode).toBe(403);
  });
});

describe('checkpoints PNJ', () => {
  let cp: string;

  it('le GM crée un checkpoint avec ses cartes', async () => {
    const zones = (await t.app.inject({ url: `/parties/${t.partieId}/zones`, headers: t.bearer(gm) })).json().zones;
    const res = await post('/checkpoints', gm, { zoneId: zones[3].id, defi: 'Énigme du pont', cartes: [t.carteIds[12], t.carteIds[12]] });
    cp = res.json().id;
    expect(res.json().ok).toBe(true);
  });

  it('défi réussi : le PNJ scanne la licence et donne une carte du stock + jenny', async () => {
    const res = await post(`/checkpoints/${cp}/reussite`, pnj, { licence: await licence(gon), carteId: t.carteIds[12], jenny: 20 });
    expect(res.json()).toMatchObject({ ok: true, joueur: 'Gon', cartes: ['La canne du châtiment céleste'] });
    const cartes = await t.db.select().from(exemplaires).where(eq(exemplaires.joueurId, gon.id));
    expect(cartes.some((x) => x.origine.type === 'pnj')).toBe(true);
    expect((await joueur(gon.id)).jenny).toBe(85);
  });

  it('RG-5.4 Matérialisation : un tirage bonus plafonné au rang C', async () => {
    await t.db.update(joueurs).set({ nen: 'materialisation' }).where(eq(joueurs.id, gon.id));
    const res = await post(`/checkpoints/${cp}/reussite`, pnj, { licence: await licence(gon) });
    const bonus = res.json().bonus;
    expect(bonus).not.toBeNull();
    if (bonus.kind === 'carte') expect(['C', 'D']).toContain(bonus.rang);
  });
});

describe('RG-8.8 expertise d’Antokiba', () => {
  it('payée même sans contrefaçon ; révèle et prévient le joueur', async () => {
    const faux = await donnerCarte(gon.id, 25, { type: 'echange', avec: kirua.id }, { nature: 'copie' });
    const avant = (await joueur(gon.id)).jenny;
    const res = await post('/expertise', pnj, { licence: await licence(gon) });
    expect(res.json()).toMatchObject({ ok: true, cout: 25, trouvees: 1 });
    expect((await joueur(gon.id)).jenny).toBe(avant - 25);
    expect((await t.db.select().from(exemplaires).where(eq(exemplaires.id, faux)))[0]!.marque).toBe('demasquee');
  });
});

describe('RG-5.7 abandon', () => {
  it('le joueur abandonne ; il ne peut plus scanner', async () => {
    expect((await post('/abandon', kirua.token)).json().ok).toBe(true);
    expect((await joueur(kirua.id)).statut).toBe('abandon');
    expect((await post('/abandon', kirua.token)).json().code).toBe('deja_sorti');
  });
});
