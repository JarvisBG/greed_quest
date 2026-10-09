// 2.11 : partie complète par l'API (inscriptions, démarrage, scans, sorts, boutique, échanges,
// tâches planifiées, fin du temps) et vérification des invariants des règles.
import type { Rank } from '@gq/shared';
import { pick, seededRng } from '@gq/engine';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYSTEME } from './core/journal.js';
import { circulation } from './core/state.js';
import { tickPartie } from './core/taches.js';
import { balises, cartes, joueurs, journal, parties, sorts, zones } from './db/schema.js';
import { CENTRE, testApp } from './test/helpers.js';

const NB_JOUEURS = 12;
const PAS_MS = 60_000;
let t: Awaited<ReturnType<typeof testApp>>;
const emissions: { a: string; evenement: string; data: unknown }[] = [];
const refusSansMotif: string[] = [];

beforeAll(async () => {
  t = await testApp({ seed: 7, nbBalises: 20 });
  t.app.gq.bus.on((e) => emissions.push({ a: e.a.type, evenement: e.evenement, data: e.data }));
});
afterAll(() => t.close());

describe('2.11 partie simulée de bout en bout', () => {
  it('150 min de jeu à 12 joueurs, invariants respectés', { timeout: 600_000 }, async () => {
    const rng = seededRng(99);
    const gm = t.app.gq.tokens.issue({ role: 'gm', sub: 'gm1', partieId: t.partieId });
    const call = async (method: 'GET' | 'POST', url: string, token: string, payload?: Record<string, unknown>) => {
      const res = await t.app.inject({ method, url: `/parties/${t.partieId}${url}`, headers: t.bearer(token), ...(payload ? { payload } : {}) });
      const body = res.json();
      if (body.ok === false && !(typeof body.message === 'string' && body.message.length > 0)) refusSansMotif.push(url);
      return body;
    };
    const ici = () => ({ lat: CENTRE.lat + (rng.next() - 0.5) * 0.0004, lng: CENTRE.lng + (rng.next() - 0.5) * 0.0004, precisionM: 8 });

    expect((await call('POST', '/cycle', gm, { action: 'ouvrir_inscriptions' })).ok).toBe(true);
    const js: { id: string; token: string }[] = [];
    for (let i = 0; i < NB_JOUEURS; i++) js.push(await t.inscrire(`Joueur${i}`));
    expect((await call('POST', '/cycle', gm, { action: 'demarrer' })).ok).toBe(true);
    const qrMasadora = (await t.db.select().from(zones).where(and(eq(zones.partieId, t.partieId), eq(zones.type, 'masadora'))))[0]!.qr!;

    const debut = t.clock.t;
    let maxJ = 0;
    for (let step = 0; ; step++) {
      t.clock.t = debut + step * PAS_MS;
      await t.app.gq.runner.run(t.partieId, SYSTEME, tickPartie);
      const [p] = await t.db.select().from(parties).where(eq(parties.id, t.partieId));
      maxJ = Math.max(maxJ, p!.j.value);
      if (p!.etat === 'terminee') break;
      if (step === 40) await call('POST', '/evenements', gm, { type: 'krach' });

      const actives = await t.db.select().from(balises).where(and(eq(balises.partieId, t.partieId), eq(balises.etat, 'active')));
      for (const j of js) {
        const pos = ici();
        await call('POST', '/position', j.token, pos);
        const r = rng.next();
        if (r < 0.7 && actives.length > 0) {
          await call('POST', '/scan', j.token, { baliseId: pick(rng, actives).id, position: pos });
        } else if (r < 0.8) {
          const mes = await t.db.select().from(sorts).where(and(eq(sorts.joueurId, j.id), eq(sorts.utilise, false)));
          const off = mes.find((s) => s.type === 'vol' || s.type === 'gel');
          const proches = (await call('GET', '/a-portee', j.token)).joueurs as { id: string }[];
          if (off && proches.length > 0) {
            await call('POST', '/sort', j.token, { sort: off.type, source: { type: 'carte', itemId: off.id }, cibleId: pick(rng, proches).id, position: pos });
          }
        } else if (r < 0.85) {
          await call('POST', '/boutique/achat', j.token, { qr: qrMasadora, position: pos });
        } else if (r < 0.9) {
          const livre = await call('GET', '/livre', j.token);
          const doublon = livre.pages.slice(3).flat().find((x: { kind?: string }) => x.kind === 'carte');
          if (doublon) await call('POST', '/boutique/revente', j.token, { qr: qrMasadora, itemId: doublon.itemId, position: pos });
        }
      }
      if (step > 200) throw new Error('La partie ne se termine pas');
    }

    // RG-13.4 : fin à l'heure, classement figé.
    const [fin] = await t.db.select().from(parties).where(eq(parties.id, t.partieId));
    expect(fin!.etat).toBe('terminee');
    expect(fin!.classementFinal).toHaveLength(NB_JOUEURS);

    // RG-8.2 : jamais plus d'exemplaires vrais en circulation que la limite maximale atteinte
    // (formules RG-14 × 2, multiplicateur par défaut depuis le calibrage).
    const lim = (J: number): Record<Rank, number> => ({
      SS: 2 * Math.max(1, Math.floor(J / 20)),
      S: 2 * Math.max(2, Math.ceil(J / 10)),
      A: 2 * Math.max(3, Math.ceil(J / 5)),
      B: 2 * Math.max(4, Math.ceil(J / 3)),
      C: 2 * Math.max(5, Math.ceil(J / 2)),
      D: 2 * Math.max(5, Math.ceil(J / 2)),
    });
    const n = await circulation(t.db, t.partieId);
    const cat = await t.db.select().from(cartes).where(eq(cartes.partieId, t.partieId));
    for (const c of cat) expect(n.get(c.id) ?? 0).toBeLessThanOrEqual(lim(maxJ)[c.rang]);

    // Stocks et jenny jamais négatifs.
    expect((await t.db.select().from(balises).where(eq(balises.partieId, t.partieId))).every((b) => b.stock >= 0)).toBe(true);
    expect((await t.db.select().from(joueurs).where(eq(joueurs.partieId, t.partieId))).every((j) => j.jenny >= 0)).toBe(true);

    // Il s'est passé des choses : tirages, ventes, sorts.
    const lignes = await t.db.select().from(journal).where(eq(journal.partieId, t.partieId));
    const ok = (action: string) => lignes.filter((l) => l.action === action && l.resultat !== 'refus').length;
    expect(ok('scan')).toBeGreaterThan(100);
    expect(ok('achat') + ok('revente')).toBeGreaterThan(0);

    // RG-7.4 : tout refus a un motif en clair.
    expect(refusSansMotif).toEqual([]);

    // RG-10.12 : aucune position exacte vers les joueurs ; l'écran ne reçoit que des points anonymes.
    for (const e of emissions) {
      const json = JSON.stringify(e.data);
      if (e.a === 'joueur' || e.a === 'joueurs') expect(json).not.toMatch(/"lat"/);
      if (e.a === 'tracker' && /"lat"/.test(json)) {
        expect(e.evenement).toBe('heatmap');
        expect(json).not.toMatch(/"(joueurId|id|pseudo)"/);
      }
    }
  });
});
