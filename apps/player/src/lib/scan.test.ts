import { describe, expect, it } from 'vitest';
import { ApiError, type Api } from './api';
import { createFile } from './file';
import { rejouerFile, scanner } from './scan';
import { memoire } from './test-utils';

const pos = { lat: 1, lng: 2, precisionM: 5 };
type Appel = { path: string; body: Record<string, unknown> };

function fausseApi(reponses: ((a: Appel) => unknown)[]) {
  const appels: Appel[] = [];
  const api = {
    get: async () => ({ ok: true }),
    post: async (path: string, body: unknown) => {
      const a = { path, body: body as Record<string, unknown> };
      appels.push(a);
      const r = reponses.shift();
      if (!r) throw new Error('appel inattendu');
      return r(a);
    },
  } as unknown as Api;
  return { api, appels };
}
const ok = () => ({ ok: true, gains: [{ kind: 'jenny', montant: 10 }], jenny: 60 });
const horsLigne = () => {
  throw new ApiError('reseau', 'Pas de connexion au serveur', 0);
};
const refus = (code: string, message: string) => () => {
  throw new ApiError(code, message, 409);
};

describe('scan (RG-7)', () => {
  it('P1 : n’envoie que l’intention (balise + position), sans heure si en ligne', async () => {
    const { api, appels } = fausseApi([ok]);
    const r = await scanner(api, createFile(memoire()), 'p', 'b1', pos, 1000);
    expect(r).toEqual({ type: 'ok', gains: [{ kind: 'jenny', montant: 10 }], jenny: 60 });
    expect(appels[0]).toEqual({ path: '/parties/p/scan', body: { baliseId: 'b1', position: pos } });
  });

  it('RG-7.4 : refus remonté en clair', async () => {
    const { api } = fausseApi([refus('boucle', 'Boucle : scanne encore 2 balises différentes')]);
    expect(await scanner(api, createFile(memoire()), 'p', 'b1', pos, 1000)).toEqual({
      type: 'refus',
      code: 'boucle',
      message: 'Boucle : scanne encore 2 balises différentes',
    });
  });

  it('RG-7.5 : sans réseau, le scan part en file (une fois par balise)', async () => {
    const f = createFile(memoire());
    const { api } = fausseApi([horsLigne, horsLigne]);
    expect(await scanner(api, f, 'p', 'b1', pos, 1000)).toEqual({ type: 'en_file' });
    expect(await scanner(api, f, 'p', 'b1', pos, 2000)).toEqual({ type: 'deja_en_file' });
    expect(f.lire()).toHaveLength(1);
  });

  it('RG-7.5 : rejeu dans l’ordre avec l’heure du scan ; périmés écartés sans appel', async () => {
    const f = createFile(memoire());
    f.ajouter({ partieId: 'p', baliseId: 'vieux', position: pos, scanneA: 0 });
    f.ajouter({ partieId: 'p', baliseId: 'b1', position: pos, scanneA: 700_000 });
    f.ajouter({ partieId: 'p', baliseId: 'b2', position: pos, scanneA: 710_000 });
    const { api, appels } = fausseApi([ok, refus('trop_tot', 'Attends 30 s entre deux scans')]);
    const r = await rejouerFile(api, f, 'p', 720_000);
    expect(r.map((x) => [x.scan.baliseId, x.issue.type])).toEqual([
      ['vieux', 'refus'],
      ['b1', 'ok'],
      ['b2', 'refus'],
    ]);
    expect(appels.map((a) => a.body.scanneA)).toEqual([700_000, 710_000]);
    expect(f.lire()).toEqual([]);
  });

  it('RG-7.5 : si le réseau retombe pendant le rejeu, le reste attend', async () => {
    const f = createFile(memoire());
    f.ajouter({ partieId: 'p', baliseId: 'b1', position: pos, scanneA: 1 });
    f.ajouter({ partieId: 'p', baliseId: 'b2', position: pos, scanneA: 2 });
    const { api } = fausseApi([ok, horsLigne]);
    const r = await rejouerFile(api, f, 'p', 10);
    expect(r).toHaveLength(1);
    expect(f.lire().map((s) => s.baliseId)).toEqual(['b2']);
  });
});
