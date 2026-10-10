import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises, evenements, exemplaires, joueurs, journal, parties } from '../db/schema.js';
import { newId } from '../ids.js';
import { testApp } from '../test/helpers.js';
import { SYSTEME } from './journal.js';
import { tickPartie } from './taches.js';

let t: Awaited<ReturnType<typeof testApp>>;
const recues: { a: string; evenement: string; data: any }[] = [];
let gon: { id: string };
let kirua: { id: string };
const MIN = 60_000;

const tickA = async (minutes: number) => {
  t.clock.t = debut + minutes * MIN;
  await t.app.gq.runner.run(t.partieId, SYSTEME, tickPartie);
};
const partie = async () => (await t.db.select().from(parties).where(eq(parties.id, t.partieId)))[0]!;
const actives = async () => (await t.db.select().from(balises).where(and(eq(balises.partieId, t.partieId), eq(balises.etat, 'active')))).length;
let debut: number;

beforeAll(async () => {
  t = await testApp();
  t.app.gq.bus.on((e) => recues.push({ a: e.a.type === 'joueur' ? e.a.id : e.a.type, evenement: e.evenement, data: e.data }));
  await t.setEtat('inscriptions', { inscriptionsOuvertes: true });
  gon = await t.inscrire('Gon');
  kirua = await t.inscrire('Kirua');
  await t.db.update(joueurs).set({ nen: 'materialisation' }).where(eq(joueurs.id, kirua.id));
  await t.inscrire('Leorio');
  debut = t.clock.t;
  await t.setEtat('en_cours', { demarreeA: debut });
});
afterAll(() => t.close());

describe('tâches planifiées', () => {
  it('RG-14.1 / RG-6.2 : au premier passage, J est calculé et les balises activées jusqu’à la cible', async () => {
    await tickA(0);
    expect((await partie()).j.value).toBe(3);
    expect(await actives()).toBe(5); // ceil(3/3) borné à 5 minimum (RG-14)
    expect(recues.some((e) => e.a === 'tracker' && e.evenement === 'balises_par_zone')).toBe(true);
    expect(recues.some((e) => e.a === 'tracker' && e.evenement === 'classement')).toBe(true);
  });

  it('RG-9.3 : la vague de boutique est ouverte avec son stock', async () => {
    expect((await partie()).vagueBoutique).toMatchObject({ index: 0, stock: 2 });
  });

  it('RG-6.3 : une balise épuisée redevient dormante après 15 min de recharge', async () => {
    const [b] = await t.db.select().from(balises).where(and(eq(balises.partieId, t.partieId), eq(balises.etat, 'active')));
    await t.db.update(balises).set({ etat: 'epuisee', stock: 0, epuiseeA: 0 }).where(eq(balises.id, b!.id));
    await tickA(14);
    expect((await t.db.select().from(balises).where(eq(balises.id, b!.id)))[0]!.etat).toBe('epuisee');
    expect(await actives()).toBe(5); // la cible est complétée par une autre balise
    await tickA(15);
    expect((await t.db.select().from(balises).where(eq(balises.id, b!.id)))[0]!.etat).toBe('dormante');
  });

  it('amendement RG-10.10 : joueur actif sans position depuis 10 min → une seule alerte à l’équipe par disparition', async () => {
    const alertes = async () => (await t.db.select().from(journal).where(and(eq(journal.action, 'alerte'), eq(journal.resultat, 'sans_position')))).length;
    expect(await alertes()).toBe(3); // les 3 joueurs n'ont plus envoyé de position depuis l'inscription
    expect(recues.some((e) => e.a === 'staff' && e.evenement === 'alerte' && e.data.type === 'sans_position')).toBe(true);
    await tickA(15.5);
    expect(await alertes()).toBe(3);
  });

  it('RG-5.7 : sans action depuis 15 min, le joueur devient inactif ; J baisse (RG-14.1)', async () => {
    await tickA(16);
    const js = await t.db.select().from(joueurs).where(eq(joueurs.partieId, t.partieId));
    expect(js.every((j) => j.statut === 'inactif')).toBe(true);
    expect((await partie()).j.value).toBe(0);
  });

  it('RG-6.4 : rotation de 30 % des balises actives toutes les 20 min', async () => {
    await tickA(20);
    const rot = await t.db.select().from(journal).where(and(eq(journal.action, 'balise'), eq(journal.resultat, 'dormante')));
    expect(rot.some((l) => (l.details as { cause: string }).cause === 'rotation')).toBe(true);
    expect(await actives()).toBe(5);
  });

  it('RG-12 : à l’échéance d’une Apparition, la balise fantôme redevient dormante', async () => {
    const [b] = await t.db.select().from(balises).where(and(eq(balises.partieId, t.partieId), eq(balises.etat, 'dormante')));
    await t.db.update(balises).set({ etat: 'active', type: 'fantome', stock: 1 }).where(eq(balises.id, b!.id));
    const id = newId();
    await t.db.insert(evenements).values({
      id,
      partieId: t.partieId,
      zoneId: b!.zoneId,
      debut: 20 * MIN,
      fin: 30 * MIN,
      etat: 'actif',
      data: { type: 'apparition', baliseId: b!.id },
    });
    await tickA(31);
    expect((await t.db.select().from(balises).where(eq(balises.id, b!.id)))[0]).toMatchObject({ etat: 'dormante', type: null });
    expect((await t.db.select().from(evenements).where(eq(evenements.id, id)))[0]!.etat).toBe('termine');
    expect(recues.some((e) => e.a === 'tracker' && e.evenement === 'evenement_fin')).toBe(true);
  });

  it('RG-8.12 : les SS d’un joueur qui abandonne retournent en jeu', async () => {
    const ss = newId();
    await t.db.insert(exemplaires).values({ id: ss, partieId: t.partieId, joueurId: gon.id, carteId: t.carteIds[0]!, origine: { type: 'kit' }, obtenuA: 0 });
    await t.db.update(joueurs).set({ statut: 'abandon' }).where(eq(joueurs.id, gon.id));
    await tickA(32);
    expect(await t.db.select().from(exemplaires).where(eq(exemplaires.id, ss))).toEqual([]);
    expect(recues.some((e) => e.a === gon.id && e.evenement === 'perte')).toBe(true);
  });

  it('RG-12.3 : agenda automatique, une proposition au GM quand il est activé', async () => {
    const p = await partie();
    await t.db.update(parties).set({ parametres: { ...p.parametres, agendaIntervalleMin: { mode: 'verrouille', value: 10 } } }).where(eq(parties.id, t.partieId));
    await tickA(33);
    await tickA(44);
    expect(recues.some((e) => e.a === 'gm' && e.evenement === 'proposition_evenement')).toBe(true);
  });

  it('Amendement 2026-10-10 : réserve de Matérialisation, un tirage bonus 40 min après l’inscription, puis toutes les 40 min', async () => {
    const reserves = await t.db.select().from(journal).where(and(eq(journal.partieId, t.partieId), eq(journal.action, 'reserve_materialisation')));
    expect(reserves).toHaveLength(1); // ticks jusqu'à 44 min : une seule réserve due (à 40 min)
    const [k] = await t.db.select().from(joueurs).where(eq(joueurs.id, kirua.id));
    expect(k?.derniereReserveA).toBe(44 * MIN);
    expect(recues.filter((e) => e.a === kirua.id && e.evenement === 'reserve')).toHaveLength(1);
  });

  it('RG-4.4 : en pause, l’horloge de jeu est arrêtée, rien ne bouge', async () => {
    t.clock.t = debut + 45 * MIN;
    await t.setEtat('pause', { pauseDepuis: t.clock.t, etatAvantPause: 'en_cours' });
    const avant = await partie();
    await tickA(200);
    const apres = await partie();
    expect(apres.etat).toBe('pause');
    expect(apres.taches).toEqual(avant.taches);
    // Reprise : 155 min de pause retirées de l'horloge de jeu.
    await t.setEtat('en_cours', { pauseDepuis: null, etatAvantPause: null, pauseCumulee: 155 * MIN });
  });

  it('RG-4.5 : phase finale 30 min avant la fin, puis fin du temps et classement figé (RG-13.4)', async () => {
    await tickA(155 + 90); // heure de jeu 90 min (durée par défaut 120 min)
    expect((await partie()).etat).toBe('phase_finale');
    await tickA(155 + 120);
    const p = await partie();
    expect(p.etat).toBe('terminee');
    expect(p.classementFinal?.map((l) => l.pseudo).sort()).toEqual(['Gon', 'Kirua', 'Leorio']);
    expect(recues.some((e) => e.a === 'tracker' && e.evenement === 'classement_final')).toBe(true);
  });
});
