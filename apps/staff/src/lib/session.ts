// Sessions de l'équipe (PNJ ou GM), gardées sur l'appareil : la partie ouverte et toutes celles où ce membre s'est
// connecté (page « Mes parties » : passer de l'une à l'autre sans retaper son code). Le stockage est injecté pour les tests.
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
const CLE_LISTE = 'gq.equipe.parties';

const valide = (s: SessionEquipe | null): s is SessionEquipe => !!s && !!s.partieId && !!s.id && !!s.token && (s.role === 'pnj' || s.role === 'gm');

export function createSessionStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const lire = <T,>(cle: string, defaut: T): T => {
    try {
      return (JSON.parse(storage.getItem(cle) ?? 'null') as T | null) ?? defaut;
    } catch {
      return defaut;
    }
  };
  const store = {
    /** Partie ouverte dans la console (null : page « Mes parties »). */
    get(): SessionEquipe | null {
      const s = lire<SessionEquipe | null>(CLE, null);
      return valide(s) ? s : null;
    },
    /** Ouvre une partie et la retient dans la liste (la plus récente en tête). */
    set(s: SessionEquipe): void {
      storage.setItem(CLE, JSON.stringify(s));
      storage.setItem(CLE_LISTE, JSON.stringify([s, ...store.liste().filter((x) => x.partieId !== s.partieId)]));
    },
    /** Ferme la partie ouverte ; elle reste dans la liste. */
    clear(): void {
      storage.removeItem(CLE);
    },
    /** Parties retenues sur cet appareil ; la session ouverte avant cette liste y est reprise. */
    liste(): SessionEquipe[] {
      const l = lire<SessionEquipe[]>(CLE_LISTE, []).filter(valide);
      const s = store.get();
      return s && !l.some((x) => x.partieId === s.partieId) ? [s, ...l] : l;
    },
    /** Déconnexion d'une partie : retirée de la liste (et fermée si c'est celle ouverte). */
    oublier(partieId: string): void {
      storage.setItem(CLE_LISTE, JSON.stringify(store.liste().filter((x) => x.partieId !== partieId)));
      if (store.get()?.partieId === partieId) store.clear();
    },
  };
  return store;
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** Partie visée : `?partie=<id>` sinon celle de la session. */
export function partieFromUrl(search: string): string | null {
  const id = codePartie(new URLSearchParams(search).get('partie') ?? '');
  return id ? id : null;
}

/** Adresse de la console pour une partie (sans `?partie`, la console ouvre « Mes parties »). */
export function adressePartie(partieId: string | null): string {
  return partieId ? `?partie=${encodeURIComponent(partieId)}` : location.pathname;
}
