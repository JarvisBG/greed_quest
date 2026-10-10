import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { licenceCode } from '../core/licence.js';
import { arene, exemplaires, joueurs, journal } from '../db/schema.js';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let pnj: string;
type J = { token: string; id: string };
let gon: J, kirua: J;
const MIN = 60_000;

beforeAll(async () => {
  t = await testApp();
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
});
afterAll(() => t.close());

const post = (url: string, token: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), payload });
const joueur = async (id: string) => (await t.db.select().from(joueurs).where(eq(joueurs.id, id)))[0]!;
const licence = async (j: J) => licenceCode(j.id, (await joueur(j.id)).licenceSecret, t.clock.t).qr;
const setJenny = (j: J, jenny: number) => t.db.update(joueurs).set({ jenny }).where(eq(joueurs.id, j.id));
const entrer = async (j: J) => post('/arene/entree', pnj, { licence: await licence(j) });

describe('Arène de Soufrabi (amendement 2026-10-09)', () => {
  it('réservée à l’équipe ; licence vérifiée', async () => {
    expect((await post('/arene/entree', gon.token, { licence: await licence(gon) })).statusCode).toBe(403);
    expect((await post('/arene/entree', pnj, { licence: 'GQL1.x.1.y' })).json()).toMatchObject({ ok: false, message: 'Licence invalide' });
  });

  it('entrée : mise de 30 J débitée, refus en clair si jenny insuffisants', async () => {
    await setJenny(kirua, 20);
    expect((await entrer(kirua)).json()).toMatchObject({ ok: false, message: 'Il faut 30 J pour entrer dans l’arène' });
    await setJenny(gon, 100);
    const res = await entrer(gon);
    expect(res.json()).toMatchObject({ ok: true, mise: 30, joueur: { pseudo: 'Gon' } });
    expect((await joueur(gon.id)).jenny).toBe(70);
    expect((await entrer(gon)).json()).toMatchObject({ ok: false, code: 'tentative_en_cours' });
    const enCours = await t.app.inject({ url: `/parties/${t.partieId}/arene`, headers: t.bearer(pnj) });
    expect(enCours.json().tentatives).toEqual([expect.objectContaining({ pseudo: 'Gon', mise: 30 })]);
  });

  it('victoire : une carte A, S ou SS entre dans le Book, provenance « arène »', async () => {
    const [tentative] = await t.db.select().from(arene).where(eq(arene.joueurId, gon.id));
    const res = await post(`/arene/${tentative!.id}/issue`, pnj, { victoire: true });
    expect(res.json()).toMatchObject({ ok: true, joueur: 'Gon', gain: { kind: 'carte' } });
    expect(['A', 'S', 'SS']).toContain(res.json().gain.rang);
    const cartes = await t.db.select().from(exemplaires).where(eq(exemplaires.joueurId, gon.id));
    expect(cartes.some((x) => (x.origine as { type: string }).type === 'arene')).toBe(true);
    expect((await post(`/arene/${tentative!.id}/issue`, pnj, { victoire: true })).json()).toMatchObject({ ok: false, code: 'tentative_terminee' });
  });

  it('une tentative toutes les 15 min ; défaite = mise perdue', async () => {
    t.clock.t += 8 * MIN;
    expect((await entrer(gon)).json()).toMatchObject({ ok: false, message: 'Prochaine tentative possible dans 7 min' });
    t.clock.t += 7 * MIN;
    const { id } = (await entrer(gon)).json();
    expect((await post(`/arene/${id}/issue`, pnj, { victoire: false })).json()).toMatchObject({ ok: true, gain: null });
    expect((await joueur(gon.id)).jenny).toBe(40);
  });

  it('annulation motivée : mise remboursée, le délai ne compte pas', async () => {
    await setJenny(kirua, 50);
    const { id } = (await entrer(kirua)).json();
    expect((await post(`/arene/${id}/annuler`, pnj, { motif: '' })).statusCode).toBe(400);
    expect((await post(`/arene/${id}/annuler`, pnj, { motif: 'Mauvais joueur scanné' })).json()).toMatchObject({ ok: true, rembourse: 30 });
    expect((await joueur(kirua.id)).jenny).toBe(50);
    expect((await entrer(kirua)).json()).toMatchObject({ ok: true });
  });

  it('RG-3.1 : entrées, issues et annulation au journal, avec l’arbitre', async () => {
    const lignes = await t.db.select().from(journal).where(eq(journal.partieId, t.partieId));
    const arenes = lignes.filter((l) => l.action.startsWith('arene_'));
    expect(arenes.map((l) => `${l.action}:${l.resultat}`)).toEqual(
      expect.arrayContaining(['arene_entree:refus', 'arene_entree:ok', 'arene_issue:gagnee', 'arene_issue:perdue', 'arene_annulation:ok']),
    );
    expect(arenes.every((l) => l.acteurType === 'pnj' && l.acteurId === 'pnj1')).toBe(true);
  });
});
