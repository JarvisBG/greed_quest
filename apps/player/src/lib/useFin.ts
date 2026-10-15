// Page ⑱ : la fin de partie côté joueur (RG-4.6, RG-13) et l'abandon (RG-5.7). Le classement figé est relu à la
// connexion si la partie est terminée et à l'évènement `classement_final` ; la cinématique « Gong et podium » est jouée
// une fois par joueur (aussi si l'app s'ouvre après la fin). Le gagnant du Clear a déjà eu le Book en gloire : pas de gong.
import { useCallback, useRef, useState } from 'react';
import { api } from './client';
import { cleFinVue, type Classement, type CineFin } from './fin';

function dejaVue(cle: string): boolean {
  try {
    return localStorage.getItem(cle) === '1';
  } catch {
    return false;
  }
}
function noterVue(cle: string) {
  try {
    localStorage.setItem(cle, '1');
  } catch {
    // stockage indisponible : la cinématique pourra revenir au prochain chargement
  }
}

export function useFin(partieId: string | null, joueurId: string | null) {
  const [classement, setClassement] = useState<Classement | null>(null);
  const [cines, setCines] = useState<{ n: number; c: CineFin }[]>([]);
  const nCine = useRef(0);
  const jouer = useCallback((c: CineFin) => setCines((l) => (l.some((x) => x.c.type === c.type) ? l : [...l, { n: ++nCine.current, c }])), []);

  /** Relit le classement final ; joue la cinématique de fin si ce joueur ne l'a pas encore vue. */
  const charger = useCallback(async () => {
    if (!partieId || !joueurId) return;
    try {
      const { ok: _ok, ...c } = await api.get<Classement & { ok: true }>(`/parties/${partieId}/classement`);
      setClassement(c);
      const cle = cleFinVue(partieId, joueurId);
      if (dejaVue(cle)) return;
      noterVue(cle);
      const moi = c.lignes.find((l) => l.moi);
      if (!(c.gagnant && moi && c.gagnant === moi.pseudo)) jouer({ type: 'fin' });
    } catch {
      // Pas encore terminée, ou hors ligne : on relira à la connexion.
    }
  }, [partieId, joueurId, jouer]);

  /** RG-5.7 : abandon confirmé (maintien 2 s) ; la licence se raye. Lève l'erreur du serveur en clair. */
  const abandonner = useCallback(async () => {
    if (!partieId) return;
    await api.post(`/parties/${partieId}/abandon`, {});
    jouer({ type: 'abandon' });
  }, [partieId, jouer]);

  return {
    classement,
    charger,
    abandonner,
    cine: cines[0]?.c ?? null,
    cineN: cines[0]?.n ?? 0,
    finCine: () => setCines((l) => l.slice(1)),
  };
}
