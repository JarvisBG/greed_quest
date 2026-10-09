import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises, exemplaires } from '../db/schema.js';
import { newId } from '../ids.js';
import { CENTRE, testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J, kirua: J;
let pnj: string;
const ici = { ...CENTRE, precisionM: 5 };

beforeAll(async () => {
  t = await testApp();
  pnj = t.app.gq.tokens.issue({ role: 'pnj', sub: 'pnj1', partieId: t.partieId });
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  await t.db.update(balises).set({ etat: 'active', type: 'standard', stock: 30 }).where(inArray(balises.id, t.baliseIds.slice(0, 12)));
});
afterAll(() => t.close());

const post = (j: J, url: string, payload: Record<string, unknown> = {}) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/${url}`, headers: t.bearer(j.token), payload });
const alertes = async () => (await t.app.inject({ url: `/parties/${t.partieId}/alertes`, headers: t.bearer(pnj) })).json().alertes as { type: string }[];

describe('RG-15 alertes', () => {
  it('rythme de scan anormal : 10 tirages en moins de 10 min → une seule alerte', async () => {
    for (let i = 0; i < 11; i++) {
      const res = await post(gon, 'scan', { baliseId: t.baliseIds[i], position: ici });
      expect(res.json().ok).toBe(true);
      t.clock.t += 31_000;
    }
    expect((await alertes()).filter((a) => a.type === 'rythme_scan')).toHaveLength(1);
  });

  it('échanges répétés déséquilibrés : 2 fois une carte S contre 1 J dans la même heure', async () => {
    for (let n = 0; n < 2; n++) {
      const carte = newId();
      await t.db.insert(exemplaires).values({ id: carte, partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[3]!, origine: { type: 'kit' }, obtenuA: 0 });
      await post(gon, 'position', ici);
      await post(kirua, 'position', ici);
      const id = (await post(gon, 'echanges', { cibleId: kirua.id, position: ici })).json().sessionId;
      await post(kirua, `echanges/${id}/reponse`, { accepte: true });
      await post(gon, `echanges/${id}/offre`, { itemIds: [carte], jenny: 0 });
      await post(kirua, `echanges/${id}/offre`, { itemIds: [], jenny: 1 });
      await post(gon, `echanges/${id}/valider`);
      expect((await post(kirua, `echanges/${id}/valider`)).json().conclu).toBe(true);
      t.clock.t += 11 * 60_000;
    }
    const a = (await alertes()).find((x) => x.type === 'echanges_desequilibres');
    expect(a).toMatchObject({ donneur: gon.id, pseudos: ['Gon', 'Kirua'] });
  });

  it('les alertes sont réservées à l’équipe', async () => {
    expect((await t.app.inject({ url: `/parties/${t.partieId}/alertes`, headers: t.bearer(gon.token) })).statusCode).toBe(403);
  });
});
