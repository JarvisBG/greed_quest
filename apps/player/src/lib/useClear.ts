// Page ⑰ : le Clear côté joueur (RG-13). État lu au chargement (GET /clear : reprise du bandeau, du choix des lots),
// évènements temps réel (`clear_confirme` au gagnant, `clear_refuse` au joueur refusé, `clear` à tous), cinématiques
// à jouer où que soit le joueur, choix des 3 lots (POST /clear/recompenses).
import { useCallback, useRef, useState } from 'react';
import { api } from './client';
import type { CineClear, EtatClear } from './clear';

export function useClear(partieId: string | null, monPseudo: () => string | null) {
  const [etat, setEtat] = useState<EtatClear>({ etat: 'aucun', gagnant: null });
  /** Cinématiques à jouer, une à une ; `n` les distingue (deux de suite du même type). */
  const [cines, setCines] = useState<{ n: number; c: CineClear }[]>([]);
  const nCine = useRef(0);
  const pseudo = useRef(monPseudo);
  pseudo.current = monPseudo;

  const charger = useCallback(async (): Promise<EtatClear | null> => {
    if (!partieId) return null;
    try {
      const { ok: _ok, ...r } = await api.get<EtatClear & { ok: true }>(`/parties/${partieId}/clear`);
      setEtat(r);
      return r;
    } catch {
      // Hors ligne : on garde ce qu'on savait.
      return null;
    }
  }, [partieId]);

  const jouer = useCallback((c: CineClear) => setCines((l) => [...l, { n: ++nCine.current, c }]), []);

  /** Évènements temps réel ; vrai si c'est un évènement du Clear (la cinématique remplace la boîte). */
  const recevoir = useCallback(
    (nom: string, data: unknown): boolean => {
      const d = (data ?? {}) as { pseudo?: string; motif?: string };
      if (nom === 'clear_refuse') {
        setEtat({ etat: 'aucun', gagnant: null });
        jouer({ type: 'refus', motif: d.motif ?? '' });
        return true;
      }
      if (nom === 'clear_confirme') {
        // La cinématique attend les cartes désignées (pochettes qui s'allument) : elle part une fois l'état relu.
        void charger().then(() => jouer({ type: 'gloire' }));
        return true;
      }
      if (nom === 'clear') {
        // Le gagnant reçoit aussi l'annonce générale : sa cinématique est celle de `clear_confirme`.
        if (d.pseudo && d.pseudo !== pseudo.current()) {
          setEtat({ etat: 'autre', gagnant: d.pseudo });
          jouer({ type: 'autre', pseudo: d.pseudo });
        }
        return true;
      }
      return false;
    },
    [charger, jouer],
  );

  /** RG-13.1 : Clear provisoire accepté par le serveur (Book gelé) ; le sceau s'imprime. */
  const declare = useCallback(() => {
    setEtat({ etat: 'declare', gagnant: null });
    jouer({ type: 'sceau' });
  }, [jouer]);

  /** RG-13.3 : les 3 cartes choisies deviennent les lots ; l'état relu donne le récapitulatif. */
  const choisirLots = useCallback(
    async (itemIds: string[]) => {
      if (!partieId) return;
      await api.post(`/parties/${partieId}/clear/recompenses`, { itemIds });
      await charger();
    },
    [partieId, charger],
  );

  return {
    etat,
    charger,
    recevoir,
    declare,
    choisirLots,
    cine: cines[0]?.c ?? null,
    cineN: cines[0]?.n ?? 0,
    finCine: () => setCines((l) => l.slice(1)),
  };
}
