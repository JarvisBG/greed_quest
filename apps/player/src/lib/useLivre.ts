import { useEffect, useState } from 'react';
import { api } from './client';
import type { LivreRecu } from './livre';

/** Charge le Livre et le recharge à chaque `version` (évènement reçu) ; garde le dernier état hors ligne. */
export function useLivre(partieId: string, version: number) {
  const [livre, setLivre] = useState<LivreRecu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    api.get<LivreRecu>(`/parties/${partieId}/livre`).then(
      (l) => {
        setLivre(l);
        setErreur(null);
      },
      (e: unknown) => setErreur(e instanceof Error ? e.message : String(e)),
    );
  }, [partieId, version]);
  return { livre, erreur };
}
