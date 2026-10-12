import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exemplaires, joueurs, journal } from '../db/schema.js';
import { newId } from '../ids.js';
import { testApp } from '../test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
type J = { token: string; id: string };
let gon: J;

beforeAll(async () => {
  t = await testApp();
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  gon = await t.inscrire('Gon');
});
afterAll(() => t.close());

const transformer = (itemId: string, numero: number) =>
  t.app.inject({ method: 'POST', url: `/parties/${t.partieId}/transformation`, headers: t.bearer(gon.token), payload: { itemId, cibleCarteId: t.carteIds[numero - 1] } });
const pret = () => t.db.update(joueurs).set({ nen: 'transformation', transformationDispoA: null }).where(eq(joueurs.id, gon.id));
async function carte(numero: number, extra: Partial<typeof exemplaires.$inferInsert> = {}) {
  const id = newId();
  await t.db.insert(exemplaires).values({ id, partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[numero - 1]!, origine: { type: 'kit' }, obtenuA: 0, ...extra });
  return id;
}

// Catalogue de démo : cartes 6-10 de rang A.
describe('RG-5.4 Texture Surprise', () => {
  it('déguise un doublon en une carte de même rang ; recharge de 20 min', async () => {
    await pret();
    await carte(6);
    const doublon = await carte(6);
    expect((await transformer(doublon, 7)).json()).toMatchObject({ ok: true, resultat: 'reussi', carteId: t.carteIds[6] });
    const [e] = await t.db.select().from(exemplaires).where(eq(exemplaires.id, doublon));
    expect(e).toMatchObject({ carteId: t.carteIds[6], marque: 'creee', faux: { nature: 'deguise', vraieCarteId: t.carteIds[5] } });
    expect((await transformer(doublon, 8)).json()).toMatchObject({ ok: false, code: 'recharge' });
  });

  it('RG-5.4 décision 2026-10-12 : sur une contrefaçon ignorée, le déguisement échoue, le pouvoir est utilisé et la carte démasquée', async () => {
    await pret();
    await carte(9);
    const copie = await carte(9, { faux: { nature: 'copie' } });
    expect((await transformer(copie, 10)).json()).toMatchObject({ ok: true, resultat: 'contrefacon', itemId: copie });
    const [e] = await t.db.select().from(exemplaires).where(eq(exemplaires.id, copie));
    expect(e).toMatchObject({ carteId: t.carteIds[8], marque: 'demasquee' });
    expect((await t.db.select().from(joueurs).where(eq(joueurs.id, gon.id)))[0]!.transformationDispoA).not.toBeNull();
    const lignes = await t.db.select().from(journal).where(eq(journal.action, 'transformation'));
    expect(lignes.at(-1)).toMatchObject({ resultat: 'contrefacon' });
  });
});
