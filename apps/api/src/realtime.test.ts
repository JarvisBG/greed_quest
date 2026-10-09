import { inArray } from 'drizzle-orm';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balises } from './db/schema.js';
import { CENTRE, testApp } from './test/helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let url: string;
const sockets: Socket[] = [];
const ici = { ...CENTRE, precisionM: 5 };

/** Connecte un client et enregistre tout ce qu'il reçoit. */
async function client(auth: Record<string, string>) {
  const recu: { evenement: string; data: any }[] = [];
  const s = connect(url, { auth, transports: ['websocket'], reconnection: false });
  sockets.push(s);
  s.onAny((evenement, data) => recu.push({ evenement, data }));
  const erreur = await new Promise<string | null>((res) => {
    s.on('connect', () => res(null));
    s.on('connect_error', (e) => res(e.message));
  });
  return { recu, erreur, evenements: () => recu.map((r) => r.evenement) };
}
const pause = () => new Promise((r) => setTimeout(r, 150));

beforeAll(async () => {
  t = await testApp();
  await t.app.listen({ port: 0, host: '127.0.0.1' });
  const addr = t.app.server.address();
  url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  await t.setEtat('en_cours', { inscriptionsOuvertes: true, demarreeA: t.clock.t });
  await t.db.update(balises).set({ etat: 'active', type: 'standard', stock: 5 }).where(inArray(balises.id, t.baliseIds.slice(0, 6)));
});
afterAll(async () => {
  for (const s of sockets) s.close();
  await t.app.close();
  await t.close();
});

describe('Diffusion temps réel (matrice REGLES.md)', () => {
  it('connexion refusée sans jeton ni écran, ou avec un jeton falsifié', async () => {
    expect((await client({})).erreur).toBe('Connexion requise');
    expect((await client({ token: 'abc.def' })).erreur).toBe('Jeton invalide');
  });

  it('tirage : détail au joueur seulement, journal à l’équipe, progression à l’écran ; position exacte au GM seulement (RG-10.12)', async () => {
    const gon = await t.inscrire('Gon');
    const kirua = await t.inscrire('Kirua');
    const cGon = await client({ token: gon.token });
    const cKirua = await client({ token: kirua.token });
    const cPnj = await client({ token: t.app.gq.tokens.issue({ role: 'pnj', sub: 'p1', partieId: t.partieId }) });
    const cGm = await client({ token: t.app.gq.tokens.issue({ role: 'gm', sub: 'g1', partieId: t.partieId }) });
    const cEcran = await client({ tracker: t.partieId });

    await t.app.inject({
      method: 'POST',
      url: `/parties/${t.partieId}/scan`,
      headers: t.bearer(gon.token),
      payload: { baliseId: t.baliseIds[0], position: ici },
    });
    await pause();

    expect(cGon.evenements()).toContain('tirage');
    expect(cKirua.evenements()).not.toContain('tirage');
    expect(cPnj.evenements()).toContain('journal');
    expect(cPnj.evenements()).not.toContain('position');
    expect(cGm.evenements()).toContain('position');
    expect(cEcran.evenements()).toContain('progression');
    expect(cEcran.evenements()).not.toContain('position');
    expect(cEcran.evenements()).not.toContain('journal');
    expect(cKirua.evenements()).not.toContain('journal');
  });
});
