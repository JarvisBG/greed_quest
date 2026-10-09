// Session joueur gardée sur le téléphone : identifiant d'appareil (RG-5.1, une inscription
// par appareil) et jeton de la partie en cours. Le stockage est injecté pour les tests.

export interface Session {
  partieId: string;
  joueurId: string;
  token: string;
}

const CLE_APPAREIL = 'gq.appareil';
const CLE_SESSION = 'gq.session';

export function createSessionStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, newId: () => string = () => crypto.randomUUID()) {
  return {
    /** Identifiant stable du téléphone, créé au premier lancement. */
    appareilId(): string {
      let id = storage.getItem(CLE_APPAREIL);
      if (!id || id.length < 16) {
        id = newId();
        storage.setItem(CLE_APPAREIL, id);
      }
      return id;
    },
    get(): Session | null {
      try {
        const s = JSON.parse(storage.getItem(CLE_SESSION) ?? 'null') as Session | null;
        return s && s.partieId && s.joueurId && s.token ? s : null;
      } catch {
        return null;
      }
    },
    set(s: Session): void {
      storage.setItem(CLE_SESSION, JSON.stringify(s));
    },
    clear(): void {
      storage.removeItem(CLE_SESSION);
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** Partie visée : `?partie=<id>` (QR d'accueil) sinon celle de la session. */
export function partieFromUrl(search: string): string | null {
  const id = new URLSearchParams(search).get('partie')?.trim();
  return id ? id : null;
}
