// Libellés et formats affichés au joueur (français).
import type { GameState, NenType, SpellType } from '@gq/shared';
import type { EvenementJoueur } from './realtime';
import type { Gain, IssueScan } from './scan';

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

/** RG-10 */
export const SORTS: Record<SpellType, { nom: string; effet: string }> = {
  vol: { nom: 'Vol', effet: 'Prend 1 carte au hasard à un joueur proche' },
  echange_force: { nom: 'Échange forcé', effet: 'Donne 1 carte choisie à un joueur proche et lui en prend 1 au hasard' },
  gel: { nom: 'Gel', effet: 'Un joueur proche ne peut plus scanner pendant 3 min' },
  barriere: { nom: 'Barrière', effet: 'Annule le prochain sort offensif reçu' },
  radar: { nom: 'Radar', effet: 'Montre la zone de la dernière position d’un joueur' },
  revelation: { nom: 'Révélation', effet: 'Montre la zone d’une balise rare active' },
  duplication: { nom: 'Duplication', effet: 'Copie une carte de ton Livre (contrefaçon si la limite est atteinte)' },
  analyse: { nom: 'Analyse', effet: 'Révèle les contrefaçons d’une page de ton Livre' },
};

/** RG-5.4 : type de Nen et son passif. */
export const NENS: Record<NenType, { nom: string; passif: string }> = {
  renforcement: { nom: 'Renforcement', passif: 'Annule le premier sort offensif reçu (une fois par partie)' },
  emission: { nom: 'Émission', passif: 'Lance un sort offensif hors de portée (une fois par partie)' },
  transformation: { nom: 'Transformation', passif: 'Texture Surprise : déguise un doublon en une autre carte de même rang (toutes les 20 min)' },
  materialisation: { nom: 'Matérialisation', passif: 'Un tirage bonus (rang C au plus) à chaque checkpoint réussi' },
  manipulation: { nom: 'Manipulation', passif: 'Un échange forcé gratuit (une fois par partie)' },
  specialisation: { nom: 'Spécialisation', passif: 'Type rare : un pouvoir unique et secret, révélé par l’organisation' },
};

/** RG-8.3 : un gain en une ligne. */
export function libelleGain(g: Gain): string {
  if (g.kind === 'carte') return `${g.nom} (rang ${g.rang})`;
  if (g.kind === 'sort') return `Sort ${SORTS[g.sort].nom}`;
  return `${g.montant} J`;
}

export function resumeIssue(i: IssueScan): string {
  if (i.type === 'ok') return i.gains.map(libelleGain).join(' + ');
  if (i.type === 'refus') return i.message;
  if (i.type === 'en_file') return 'pas de réseau, scan gardé et envoyé au retour de la connexion';
  return 'cette balise attend déjà dans la file';
}
