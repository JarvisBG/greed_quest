import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from './api';

const reponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('client API', () => {
  it('envoie le jeton et le corps JSON, renvoie la réponse ok', async () => {
    let vu: { url: string; init: RequestInit } | null = null;
    const api = createApi({
      baseUrl: 'http://api',
      getToken: () => 'jeton',
      fetch: async (url, init) => {
        vu = { url: String(url), init: init! };
        return reponse(200, { ok: true, joueurId: 'j1' });
      },
    });
    const r = await api.post<{ joueurId: string }>('/parties/p/scan', { qr: 'x' });
    expect(r.joueurId).toBe('j1');
    expect(vu!.url).toBe('http://api/parties/p/scan');
    expect((vu!.init.headers as Record<string, string>).authorization).toBe('Bearer jeton');
    expect(vu!.init.body).toBe('{"qr":"x"}');
  });

  it('RG-7.4 : un refus remonte le code et le message en clair', async () => {
    const api = createApi({ baseUrl: '', getToken: () => null, fetch: async () => reponse(409, { ok: false, code: 'trop_tot', message: 'Attends 30 s' }) });
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'trop_tot', message: 'Attends 30 s', status: 409 });
  });

  it('RG-7.5 : réseau coupé = erreur « hors ligne » rejouable', async () => {
    const api = createApi({ baseUrl: '', getToken: () => null, fetch: async () => { throw new TypeError('Failed to fetch'); } });
    const e = await api.get('/x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).horsLigne).toBe(true);
  });

  it('réponse non JSON : message générique avec le statut', async () => {
    const api = createApi({ baseUrl: '', getToken: () => null, fetch: async () => new Response('Bad Gateway', { status: 502 }) });
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'erreur', status: 502 });
  });
});
