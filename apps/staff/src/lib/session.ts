// Session d'un membre de l'équipe (PNJ ou GM), gardée sur l'appareil. Le stockage est injecté pour les tests.
import { codePartie } from '@gq/shared';

export type Role = 'pnj' | 'gm';

export interface SessionEquipe {
  partieId: string;
  id: string;
  nom: string;
  role: Role;
  token: string;
}

const CLE = 'gq.equipe';

export function createSessionStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  return {
    get(): SessionEquipe | null {
      try {
        const s = JSON.parse(storage.getItem(CLE) ?? 'null') as SessionEquipe | null;
        return s && s.partieId && s.id && s.token && (s.role === 'pnj' || s.role === 'gm') ? s : null;
      } catch {
        return null;
      }
    },
    set(s: SessionEquipe): void {
      storage.setItem(CLE, JSON.stringify(s));
    },
    clear(): void {
      storage.removeItem(CLE);
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** Partie visée : `?partie=<id>` sinon celle de la session. */
export function partieFromUrl(search: string): string | null {
  const id = codePartie(new URLSearchParams(search).get('partie') ?? '');
  return id ? id : null;
}
