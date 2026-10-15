// Page ⑯ : le raid côté joueur (RG-12). L'alarme au lancement, la barre de vie en direct, mes réponses (reprise
// après rechargement : GET /raid), l'issue à jouer (victoire et paquet de 3 sorts, ou fuite) où que soit le joueur.
import type { SpellType } from '@gq/shared';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from './api';
import { api } from './client';
import type { Question } from './quiz';
import { bossDe, coupsDe, fusionnerCoup, type EvRaid, type IssueRaid, type VueRaid } from './raid';

/** Un coup d'un autre joueur, pour l'éclat nommé sur le boss. */
export interface CoupAutre {
  n: number;
  pseudo: string;
}

interface Lu {
  questions: Question[];
  raid: (Omit<VueRaid, 'recuA'> & { bossId?: string | null }) | null;
}

export function useRaid(partieId: string | null, joueurId: string | null) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [vue, setVue] = useState<VueRaid | null>(null);
  const vueRef = useRef<VueRaid | null>(null);
  vueRef.current = vue;
  /** Alarme à jouer (le GM vient de lancer le raid). */
  const [alarme, setAlarme] = useState<{ id: string } | null>(null);
  const [issue, setIssue] = useState<IssueRaid | null>(null);
  const [coupAutre, setCoupAutre] = useState<CoupAutre | null>(null);
  const nCoup = useRef(0);
  /** Sorts de la récompense (`recompense_raid` arrive juste avant `evenement_fin`). */
  const sorts = useRef<SpellType[] | null>(null);
  /** Ma réponse a porté le dernier coup. */
  const coupFinal = useRef<string | null>(null);

  const charger = useCallback(async () => {
    if (!partieId) return;
    try {
      const r = await api.get<Lu>(`/parties/${partieId}/raid`);
      setQuestions(r.questions);
      setVue(r.raid ? { ...r.raid, recuA: Date.now() } : null);
    } catch {
      // Hors ligne : on garde ce qu'on savait.
    }
  }, [partieId]);

  /** Évènements temps réel ; vrai si l'évènement est celui du raid (pas d'autre boîte). */
  const recevoir = useCallback(
    (nom: string, data: unknown): boolean => {
      const d = data as { id?: string; type?: string; reussi?: boolean; annule?: boolean } | null;
      if (nom === 'raid') {
        const ev = data as EvRaid;
        const avant = vueRef.current;
        setVue((v) => fusionnerCoup(v, ev, Date.now()));
        if (avant?.id !== ev.id) void charger();
        if (ev.par && ev.par.id !== joueurId) setCoupAutre({ n: ++nCoup.current, pseudo: ev.par.pseudo });
        return true;
      }
      if (nom === 'evenement' && d?.type === 'raid' && d.id) {
        sorts.current = null;
        coupFinal.current = null;
        setAlarme({ id: d.id });
        void charger();
        return true;
      }
      if (nom === 'recompense_raid') {
        sorts.current = (data as { sorts: SpellType[] }).sorts;
        return true;
      }
      if (nom === 'evenement_fin' && d?.type === 'raid' && d.id) {
        const v = vueRef.current;
        const boss = bossDe(v?.bossId);
        setAlarme(null);
        if (!d.annule) {
          setIssue(
            d.reussi
              ? { type: 'victoire', id: d.id, boss, coups: v ? coupsDe(v.reponses) : 0, coupFinal: coupFinal.current === d.id, sorts: sorts.current ?? [] }
              : { type: 'fuite', id: d.id, boss, pv: v?.pv ?? 0 },
          );
        }
        setVue((x) => (x && x.id === d.id ? { ...x, pv: d.reussi ? 0 : x.pv, resteMs: 0 } : x));
        sorts.current = null;
        // Annulé par le GM : la boîte habituelle le dit.
        return !d.annule;
      }
      return false;
    },
    [charger, joueurId],
  );

  /** RG-12 : une réponse par question ; une bonne réponse retire 1 PV. Refus en clair (déjà répondu, raid fini). */
  const repondre = useCallback(
    async (questionId: string, choix: number): Promise<{ correcte: boolean } | { refus: string }> => {
      const v = vueRef.current;
      if (!partieId || !v) return { refus: 'Aucun raid en cours' };
      try {
        const r = await api.post<{ correcte: boolean; pv: number; vaincu: boolean }>(`/parties/${partieId}/raid/reponse`, { questionId, choix });
        if (r.vaincu) coupFinal.current = v.id;
        setVue((x) => (x && x.id === v.id ? { ...x, pv: Math.min(x.pv, r.pv), reponses: { ...x.reponses, [questionId]: r.correcte } } : x));
        return { correcte: r.correcte };
      } catch (e) {
        // Déjà répondu (autre appareil) : la question est close, on relit.
        if (e instanceof ApiError && e.code === 'deja_repondu') void charger();
        return { refus: e instanceof Error ? e.message : String(e) };
      }
    },
    [partieId, charger],
  );

  return {
    questions,
    vue,
    charger,
    recevoir,
    repondre,
    coupAutre,
    alarme,
    finAlarme: () => setAlarme(null),
    issue,
    finIssue: () => setIssue(null),
  };
}
