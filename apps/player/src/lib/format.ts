// Libellés et formats affichés au joueur (français).
import type { GameState, NenType, ObjetType, PouvoirSpe, SpellType } from '@gq/shared';
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
  reserve: 'Matérialisation : tirage bonus',
  expertise: 'Expertise',
  correction: 'Correction de l’équipe',
  sanction: 'Sanction',
  degel: 'Tu n’es plus gelé',
  partie: 'La partie change d’état',
  clear: 'Clear annoncé',
  clear_confirme: 'Clear confirmé',
  clear_refuse: 'Clear refusé',
  classement_final: 'Classement final',
  raid: 'Raid : le boss perd des PV',
  arene: 'Arène de Soufrabi',
  accompagnement: 'Accompagnement : position de ta cible',
};

export function libelleEvenement(nom: EvenementJoueur): string {
  return EVENEMENTS[nom];
}

/** RG-10 */
/** Amendement 2026-10-10 : pouvoirs de Spécialisation (recharge 40 min). */
export const POUVOIRS_SPE: Record<PouvoirSpe, { nom: string; effet: string }> = {
  alchimie: { nom: 'Alchimie', effet: 'Change un doublon en une carte de ton choix, du même rang ou du rang au-dessus (jamais la SS)' },
  bandit: { nom: 'L’épée du vol', effet: 'Un Vol sans carte de sort, sur la carte de ton choix (jamais la SS)' },
  zetsu: { nom: 'Zetsu', effet: 'Invisible 10 min : personne ne peut te viser ni te voir dans les listes' },
  fortune: { nom: 'Fortune', effet: 'Ton prochain scan donne un gain de plus' },
};

/** Amendement 2026-10-10 : cartes objets. */
export const OBJETS: Record<ObjetType, { nom: string; effet: string }> = {
  pepite: { nom: 'Pépite d’or', effet: 'Se revend 30 J à Masadora' },
  ticket: { nom: 'Loterie', effet: 'À gratter : 0, 10, 30 ou 100 J' },
  boussole: { nom: 'Boussole du chercheur', effet: 'Indique la direction d’une balise active que tu n’as jamais scannée' },
  souffle: { nom: 'Second souffle', effet: 'Rescanne une balise sans faire la boucle des autres balises' },
  voile: { nom: 'Rideau noir', effet: 'Bloque la prochaine Trace, Voyance ou Clairvoyance lancée sur toi' },
  coffre: { nom: 'Solidité', effet: 'Une carte de ton choix ne peut être ni volée ni prise pendant 20 min' },
};

export const SORTS: Record<SpellType, { nom: string; effet: string }> = {
  // Noms de l'anime (traduction française), amendements 2026-10-10.
  vol: { nom: 'Vol', effet: 'Prend 1 carte au hasard dans les emplacements fixes d’un joueur proche' },
  pickpocket: { nom: 'Pickpocket', effet: 'Prend 1 carte au hasard dans les emplacements libres d’un joueur proche' },
  echange_force: { nom: 'Échange', effet: 'Donne 1 carte choisie à un joueur proche et lui en prend 1 au hasard' },
  gel: { nom: 'Gel', effet: 'Un joueur proche ne peut plus scanner pendant 3 min' },
  barriere: { nom: 'Mur défensif', effet: 'Annule le prochain sort offensif reçu' },
  radar: { nom: 'Trace', effet: 'Montre la zone de la dernière position d’un joueur' },
  revelation: { nom: 'Guide', effet: 'Montre la zone d’une balise rare active' },
  duplication: { nom: 'Mimétisme', effet: 'Copie une carte de ton Book (contrefaçon si la limite est atteinte)' },
  analyse: { nom: 'Pénétration', effet: 'Rend leur vraie apparence aux cartes modifiées d’une page de ton Book' },
  regard: { nom: 'Voyance', effet: 'Montre les emplacements libres d’un joueur déjà croisé' },
  clairvoyance: { nom: 'Clairvoyance', effet: 'Montre les emplacements fixes d’un joueur déjà croisé' },
  accompagnement: { nom: 'Accompagnement', effet: 'Montre la position d’un joueur déjà croisé pendant 3 min et le gèle 3 min' },
  retour: { nom: 'Retour', effet: 'Utilise à distance une ville déjà visitée pendant 10 min' },
};

/** RG-5.4 : type de Nen et son passif. */
export const NENS: Record<NenType, { nom: string; passif: string }> = {
  renforcement: { nom: 'Renforcement', passif: 'Annule le prochain sort offensif reçu (se recharge en 30 min)' },
  emission: { nom: 'Émission', passif: 'Lance un sort offensif hors de portée (se recharge en 40 min)' },
  transformation: { nom: 'Transformation', passif: 'Texture Surprise : déguise un doublon en une autre carte de même rang (toutes les 20 min)' },
  materialisation: { nom: 'Matérialisation', passif: 'Un tirage bonus (rang C au plus) à chaque checkpoint réussi, et un toutes les 40 min' },
  manipulation: { nom: 'Manipulation', passif: 'Un échange forcé gratuit (se recharge en 40 min)' },
  specialisation: { nom: 'Spécialisation', passif: 'Type rare : un pouvoir secret parmi quatre, qui se recharge en 40 min' },
};

/** RG-8.3 : un gain en une ligne. */
export function libelleGain(g: Gain): string {
  if (g.kind === 'carte') return `${g.nom} (rang ${g.rang})`;
  if (g.kind === 'sort') return `Sort ${SORTS[g.sort].nom}`;
  if (g.kind === 'objet') return `Objet ${OBJETS[g.objet].nom}`;
  return `${g.montant} J`;
}

export function resumeIssue(i: IssueScan): string {
  if (i.type === 'ok') return i.gains.map(libelleGain).join(' + ');
  if (i.type === 'refus') return i.message;
  if (i.type === 'en_file') return 'pas de réseau, scan gardé et envoyé au retour de la connexion';
  return 'cette balise attend déjà dans la file';
}

/** RG-8.1 : cartes numérotées 001..N. */
export const numeroCarte = (n: number | null) => (n === null ? '???' : String(n).padStart(3, '0'));

/** RG-8.5 : pages de 10, d'abord les cartes désignées (« 001 – 010 »), puis les emplacements libres. */
export function titrePage(i: number, total: number): string {
  const pagesDesignees = Math.ceil(total / 10);
  if (i < pagesDesignees) return `${numeroCarte(i * 10 + 1)} – ${numeroCarte(Math.min(total, (i + 1) * 10))}`;
  return `Libres ${i - pagesDesignees + 1}`;
}

/** RG-4 : temps restant affiché, décompté localement tant que la partie tourne (figé en pause). */
export function restantAffiche(restantMs: number, recueA: number, etat: string, maintenant: number): number {
  const enCours = etat === 'en_cours' || etat === 'phase_finale';
  return Math.max(0, enCours ? restantMs - (maintenant - recueA) : restantMs);
}

/** Chrono de la barre : « 1:05:09 » ou « 12:04 ». */
export function formatChrono(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
