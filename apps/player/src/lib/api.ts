// Client HTTP de l'API. P1 : on n'envoie que des intentions ; le serveur répond
// `{ ok: true, … }` ou `{ ok: false, code, message }` (message en clair, RG-7.4).

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
  /** Pas de réponse du serveur (réseau coupé) : l'intention peut être rejouée plus tard (RG-7.5). */
  get horsLigne(): boolean {
    return this.code === 'reseau';
  }
}

export interface ApiOptions {
  baseUrl: string;
  getToken: () => string | null;
  fetch?: typeof fetch;
}

export type Ok<T> = { ok: true } & T;

export function createApi({ baseUrl, getToken, fetch: f }: ApiOptions) {
  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Ok<T>> {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res: Response;
    try {
      // fetch lu à chaque appel (pas de référence figée au chargement).
      res = await (f ?? globalThis.fetch)(baseUrl + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch {
      throw new ApiError('reseau', 'Pas de connexion au serveur', 0);
    }
    type Corps = { ok?: boolean; code?: string; message?: string };
    const data = (await res.json().catch(() => null)) as Corps | null; // null : réponse vide ou non JSON
    if (!res.ok || !data || data.ok !== true) {
      throw new ApiError(data?.code ?? 'erreur', data?.message ?? `Erreur du serveur (${res.status})`, res.status);
    }
    return data as Ok<T>;
  }
  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  };
}

export type Api = ReturnType<typeof createApi>;
