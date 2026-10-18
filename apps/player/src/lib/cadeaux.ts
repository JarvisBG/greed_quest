// Ce que l'équipe donne ou retire au joueur (correction du GM, checkpoint, carte de Maître du jeu) et le résultat
// d'une expertise : la cinématique du tirage montre ce qui arrive, puis la boîte du jeu dit d'où ça vient.
import type { CarteGm } from '@gq/shared';
import { texteGmObtenue } from './cartesGm';
import type { Gain } from './scan';

export interface Cadeau {
  id: number;
  /** Gains à faire jaillir (vide : la boîte seule). */
  gains: Gain[];
  qui: string;
  texte: string;
}

const avecMotif = (texte: string, motif: unknown) => (typeof motif === 'string' && motif.trim() ? `${texte} Motif : ${motif.trim()}` : texte);
const estGains = (x: unknown): x is Gain[] => Array.isArray(x);

/** Évènement du serveur → cadeau à montrer, ou null s'il ne s'agit pas d'un cadeau. */
export function cadeauDe(nom: string, data: unknown, id: number): Cadeau | null {
  const d = (data ?? {}) as Record<string, unknown>;
  if (nom === 'correction') {
    const gains = estGains(d.gains) ? d.gains : [];
    if (typeof d.delta === 'number') {
      const n = Math.abs(d.delta);
      if (d.delta > 0) return { id, gains: [{ kind: 'jenny', montant: n }], qui: 'Maître du jeu', texte: avecMotif(`Le Game Master te donne ${n} J.`, d.motif) };
      return { id, gains: [], qui: 'Maître du jeu', texte: avecMotif(`Le Game Master te retire ${n} J.`, d.motif) };
    }
    if (gains.length) return { id, gains, qui: 'Maître du jeu', texte: avecMotif('Cadeau du Game Master : la carte est rangée dans ton Book.', d.motif) };
    if (typeof d.retrait === 'string') return { id, gains: [], qui: 'Maître du jeu', texte: avecMotif(`Le Game Master retire ${d.retrait} de ton Book.`, d.motif) };
    return { id, gains: [], qui: 'Maître du jeu', texte: avecMotif('Le Game Master a corrigé ton Book.', d.motif) };
  }
  if (nom === 'checkpoint') {
    const gains = estGains(d.gains) ? d.gains : [];
    return { id, gains, qui: 'Checkpoint', texte: 'Défi réussi ! Ta récompense est rangée.' };
  }
  if (nom === 'carte_gm_obtenue' && d.par === 'gm' && typeof d.gm === 'string') {
    const gm = d.gm as CarteGm;
    return { id, gains: [{ kind: 'gm', gm }], qui: 'Maître du jeu', texte: texteGmObtenue(gm, 'gm') };
  }
  if (nom === 'expertise') {
    const n = Array.isArray(d.contrefacons) ? d.contrefacons.length : 0;
    const ou = typeof d.page === 'number' ? `de la page ${d.page}` : 'de tout ton Book';
    const cout = typeof d.cout === 'number' ? ` (${d.cout} J)` : '';
    const verdict =
      n === 0 ? 'aucune contrefaçon, tes cartes sont authentiques.' : `${n} contrefaçon${n > 1 ? 's' : ''} démasquée${n > 1 ? 's' : ''}, marquée${n > 1 ? 's' : ''} dans ton Book.`;
    return { id, gains: [], qui: 'Expertise', texte: `Expertise ${ou}${cout} : ${verdict}` };
  }
  return null;
}
