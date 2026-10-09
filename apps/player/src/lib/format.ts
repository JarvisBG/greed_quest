// Libellés et formats affichés au joueur (français).
import type { GameState } from '@gq/shared';
import type { EvenementJoueur } from './realtime';

const ETATS: Record<GameState, string> = {
  brouillon: 'En préparation',
  inscriptions: 'Inscriptions ouvertes',
  en_cours: 'En cours',
  pause: 'En pause',
  phase_finale: 'Phase finale',
  terminee: 'Terminée',
};

export function libelleEtat(etat: string): string {
  return ETATS[etat as GameState] ?? etat;
}

/** Durée en « 1 h 05 », « 12 min » ou « 45 s ». */
export function formatDuree(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

const EVENEMENTS: Record<EvenementJoueur, string> = {
  tirage: 'Nouveau tirage',
  perte: 'Carte perdue',
  sort_recu: 'Un sort te vise',
  malediction: 'Malédiction',
  carte_maudite: 'Carte maudite',
  echange: 'Échange',
  boutique: 'Boutique',
  enchere: 'Enchère',
  enchere_close: 'Enchère close',
  enchere_gagnee: 'Enchère gagnée',
  evenement: 'Nouvel évènement',
  evenement_fin: 'Fin d’évènement',
  mission: 'Mission',
  mission_reussie: 'Mission réussie',
  recompense_raid: 'Récompense du raid',
  checkpoint: 'Checkpoint',
  expertise: 'Expertise',
  correction: 'Correction de l’équipe',
  sanction: 'Sanction',
  degel: 'Tu n’es plus gelé',
  partie: 'La partie change d’état',
  clear: 'Clear annoncé',
  clear_confirme: 'Clear confirmé',
  clear_refuse: 'Clear refusé',
  classement_final: 'Classement final',
};

export function libelleEvenement(nom: EvenementJoueur): string {
  return EVENEMENTS[nom];
}
