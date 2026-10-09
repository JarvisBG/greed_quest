import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { journal, joueurs } from '../db/schema.js';
import { testDb } from '../test/helpers.js';
import { Bus, type Emission } from './bus.js';
import { MotifManquant } from './journal.js';
import { Runner } from './runner.js';

let t: Awaited<ReturnType<typeof testDb>>;
const bus = new Bus();
const recues: Emission[] = [];
bus.on((e) => recues.push(e));
let runner: Runner;
beforeAll(async () => {
  t = await testDb();
  runner = new Runner(t.db, bus, () => 1_000);
});
afterAll(() => t.close());

const lignes = () => t.db.select().from(journal).where(eq(journal.partieId, t.partieId));

describe('RG-3.1 journal', () => {
  it('une action écrit sa ligne avec son auteur, et diffuse après commit', async () => {
    await runner.run(t.partieId, { type: 'gm', id: 'gm1' }, async (c) => {
      await c.log({ action: 'reglage_parametre', resultat: 'ok', details: { cle: 'kBoucle' } });
      c.emit({ type: 'staff' }, 'journal', { action: 'reglage_parametre' });
    });
    const l = await lignes();
    expect(l.at(-1)).toMatchObject({ acteurType: 'gm', acteurId: 'gm1', action: 'reglage_parametre', resultat: 'ok', heureJeu: 0 });
    expect(recues.at(-1)?.evenement).toBe('journal');
  });

  it('RG-3.1 : motif obligatoire pour une sanction du PNJ ou du GM', async () => {
    const avant = (await lignes()).length;
    await expect(
      runner.run(t.partieId, { type: 'pnj', id: 'pnj1' }, (c) => c.log({ action: 'gel_sanction', resultat: 'ok' })),
    ).rejects.toThrow(MotifManquant);
    await runner.run(t.partieId, { type: 'pnj', id: 'pnj1' }, (c) =>
      c.log({ action: 'gel_sanction', resultat: 'ok', motif: 'Photo de balise' }),
    );
    expect((await lignes()).length).toBe(avant + 1);
  });

  it('transactionnel : une action qui échoue n’écrit ni état ni journal, et ne diffuse rien', async () => {
    const avant = (await lignes()).length;
    const nbEmis = recues.length;
    await expect(
      runner.run(t.partieId, { type: 'systeme', id: null }, async (c) => {
        await c.tx.insert(joueurs).values({ id: 'jx', partieId: t.partieId, pseudo: 'X', appareilId: 'ax', licenceSecret: 's' });
        await c.log({ action: 'inscription', resultat: 'ok' });
        c.emit({ type: 'tracker' }, 'fil', {});
        throw new Error('boum');
      }),
    ).rejects.toThrow('boum');
    expect((await lignes()).length).toBe(avant);
    expect(await t.db.select().from(joueurs).where(eq(joueurs.id, 'jx'))).toEqual([]);
    expect(recues.length).toBe(nbEmis);
  });

  it('les actions d’une même partie sont sérialisées', async () => {
    const ordre: number[] = [];
    await Promise.all(
      [1, 2, 3].map((i) =>
        runner.run(t.partieId, { type: 'systeme', id: null }, async () => {
          ordre.push(i);
          await new Promise((r) => setTimeout(r, 5 * (4 - i)));
          ordre.push(i);
        }),
      ),
    );
    expect(ordre).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
