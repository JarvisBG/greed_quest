// Données reçues de l'API et libellés affichés à l'équipe (français).
import type { NenType, PlayerStatus, Rank } from '@gq/shared';

export interface JoueurVue {
  id: string;
  pseudo: string;
  statut: PlayerStatus;
  nen: NenType | null;
  jenny?: number;
  geleJusqua?: number | null;
  pouvoirSpe?: string | null;
  /** Clear déclaré, en attente du GM (RG-13.1). */
  livreGele?: boolean;
}

export interface CarteCatalogue {
  id: string;
  numero: number;
  nom: string;
  rang: Rank;
  designee: boolean;
  lotReel?: string | null;
}

export interface Checkpoint {
  id: string;
  zoneId: string;
  defi: string;
  /** Stock : un id par exemplaire à donner. */
  cartes: string[];
  arbitreId: string | null;
}

export interface Zone {
  id: string;
  nom: string;
  type: string;
}

export interface LigneJournal {
  id: number;
  creeLe: string;
  heureJeu: number;
  acteurType: 'joueur' | 'pnj' | 'gm' | 'systeme';
  acteurId: string | null;
  action: string;
  resultat: string;
  motif: string | null;
  details: Record<string, unknown> | null;
}

export interface Alerte {
  id?: number;
  type: string;
  heureJeu: number;
  creeLe?: string;
  joueurId?: string;
  joueurs?: string[];
  pseudo?: string;
  pseudos?: string[];
  baliseId?: string;
  [k: string]: unknown;
}

export const numeroCarte = (n: number) => String(n).padStart(3, '0');

/** RG-5.2 : licence QR tournante `GQL1.<joueur>.<fenêtre>.<signature>` (vérifiée par le serveur). */
export function lireLicence(texte: string): string | null {
  const t = texte.trim();
  return /^GQL1\.[^.\s]+\.\d+\.[^.\s]+$/.test(t) ? t : null;
}

const STATUTS: Record<PlayerStatus, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  gele: 'Gelé',
  disqualifie: 'Disqualifié',
  abandon: 'Abandon',
};
export const libelleStatut = (s: PlayerStatus) => STATUTS[s] ?? s;

const NENS: Record<NenType, string> = {
  renforcement: 'Renforcement',
  emission: 'Émission',
  transformation: 'Transformation',
  materialisation: 'Matérialisation',
  manipulation: 'Manipulation',
  specialisation: 'Spécialisation',
};
export const libelleNen = (n: NenType | null) => (n ? NENS[n] : 'Nen non révélé');

/** Heure réelle « 14h05 ». */
export function heure(d: Date | string | number): string {
  const x = new Date(d);
  return `${x.getHours()}h${String(x.getMinutes()).padStart(2, '0')}`;
}

/** Compte à rebours « 2:05 ». */
export function formatRebours(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** RG-15 : alerte en une phrase. */
export function libelleAlerte(a: Alerte): string {
  const qui = a.pseudo ?? a.pseudos?.join(' et ') ?? 'Un joueur';
  switch (a.type) {
    case 'double_inscription':
      return `${qui} : deuxième inscription tentée depuis le même téléphone (« ${String(a.pseudoTente ?? '?')} »)`;
    case 'vitesse':
      return `${qui} : déplacement trop rapide (${String(a.vitesseKmh ?? '?')} km/h)`;
    case 'photo_partagee':
      return `${qui} : balise scannée au même moment par deux joueurs éloignés (photo partagée ?)`;
    case 'echanges_desequilibres':
      return `${qui} : échanges répétés déséquilibrés (${String(a.echanges ?? '?')} échanges)`;
    case 'rythme_scan':
      return `${qui} : rythme de scan anormal (${String(a.tirages ?? '?')} tirages en ${String(a.fenetreMin ?? '?')} min)`;
    case 'sans_position':
      return `${qui} : plus de position depuis ${String(a.depuisMin ?? '?')} min`;
    case 'changement_telephone':
      return `${qui} : partie reprise sur un autre téléphone avec son code de secours`;
    default:
      return `${qui} : ${a.type}`;
  }
}

/** Joueurs visés par une alerte (pour agir dessus depuis la console). */
export function joueursAlerte(a: Alerte): string[] {
  return a.joueurs ?? (a.joueurId ? [a.joueurId] : []);
}

const ACTIONS: Record<string, string> = {
  inscription: 'Inscription',
  reconnexion: 'Partie reprise sur un autre téléphone',
  code_secours: 'Nouveau code de secours',
  examen: 'Examen',
  statut: 'Changement de statut',
  scan: 'Scan',
  sort: 'Sort',
  transformation: 'Texture Surprise',
  achat: 'Achat en boutique',
  revente: 'Revente en boutique',
  echange_proposition: 'Proposition d’échange',
  echange: 'Échange',
  enchere_ouverture: 'Enchère ouverte',
  enchere_inscription: 'Inscription à une enchère',
  enchere_offre: 'Offre d’enchère',
  enchere_cloture: 'Enchère close',
  checkpoint: 'Checkpoint réussi',
  checkpoint_creation: 'Checkpoint créé',
  expertise: 'Expertise',
  avertissement: 'Avertissement',
  gel_sanction: 'Gel (sanction)',
  annulation_gains: 'Gains d’une balise annulés',
  disqualification: 'Disqualification',
  correction_livre: 'Correction du Livre',
  correction_jenny: 'Correction des jenny',
  evenement: 'Évènement',
  evenement_fin: 'Fin d’évènement',
  raid_reponse: 'Réponse au raid',
  malediction: 'Malédiction',
  clear_demande: 'Clear annoncé',
  clear: 'Clear confirmé',
  clear_annulation: 'Clear annulé',
  recompenses: 'Récompenses',
  abandon: 'Abandon',
  alerte: 'Alerte',
  cycle_de_vie: 'Cycle de la partie',
  reglage_parametre: 'Paramètre',
  balise: 'Balise',
  balise_gm: 'Balise (GM)',
  balise_creation: 'Balise créée',
  rotation_forcee: 'Rotation des balises',
  zone_creation: 'Zone créée',
  ajout_staff: 'Membre de l’équipe ajouté',
  creation_partie: 'Partie créée',
  terrain_repris: 'Terrain repris d’une partie précédente',
  recalcul_j: 'Recalcul de J',
  vague_boutique: 'Vague de la boutique',
  retour_ss: 'Retour d’une SS',
  agenda: 'Agenda',
  arene_entree: 'Entrée dans l’arène',
  arene_issue: 'Combat de l’arène',
  arene_annulation: 'Entrée dans l’arène annulée',
  carte_gm: 'Carte de Maître du jeu',
  carte_gm_obtenue: 'Carte de Maître du jeu obtenue',
  retour_carte_gm: 'Carte de Maître du jeu rendue',
  carte_modification: 'Carte modifiée',
  catalogue: 'Catalogue',
  deplacement: 'Carte déplacée dans le Book',
  objet: 'Objet utilisé',
  position: 'Position',
  pouvoir_spe: 'Pouvoir de Spécialisation',
  prereglage_application: 'Préréglage appliqué',
  prereglage_creation: 'Préréglage enregistré',
  reserve_materialisation: 'Réserve de Matérialisation',
  demarrer: 'Démarrage',
  ouvrir_inscriptions: 'Ouverture des inscriptions',
  terminer: 'Fin de partie',
  couper: 'Balise coupée',
};

/** Type d'action du journal en clair. */
export const libelleAction = (a: string) => ACTIONS[a] ?? a;

/** RG-3.1 : une ligne de journal en clair (acteur, action, résultat, motif). */
export function libelleLigne(
  l: LigneJournal,
  nomActeur: (type: LigneJournal['acteurType'], id: string | null) => string,
  pseudos: Map<string, string> = new Map(),
): string {
  const action = ACTIONS[l.action] ?? l.action;
  const resultat = l.resultat === 'ok' ? '' : ` : ${l.resultat.replaceAll('_', ' ')}`;
  // Joueur visé (sanction, correction, alerte…) quand ce n'est pas l'acteur lui-même.
  const vise = typeof l.details?.joueurId === 'string' && !(l.acteurType === 'joueur' && l.acteurId === l.details.joueurId) ? pseudos.get(l.details.joueurId) : undefined;
  const motif = l.motif ? ` — « ${l.motif} »` : '';
  return `${nomActeur(l.acteurType, l.acteurId)} · ${action}${vise ? ` · ${vise}` : ''}${resultat}${motif}`;
}

export interface StockLigne {
  carte: CarteCatalogue;
  n: number;
}

/** Stock d'un checkpoint regroupé par carte, par numéro. */
export function stockCheckpoint(ids: string[], catalogue: CarteCatalogue[]): StockLigne[] {
  const parId = new Map(catalogue.map((c) => [c.id, c]));
  const n = new Map<string, number>();
  for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1);
  return [...n]
    .flatMap(([id, k]) => {
      const carte = parId.get(id);
      return carte ? [{ carte, n: k }] : [];
    })
    .sort((a, b) => a.carte.numero - b.carte.numero);
}

/** Recherche d'une carte du catalogue par numéro ou par nom (sans accents ni casse). */
export function chercherCartes(catalogue: CarteCatalogue[], q: string): CarteCatalogue[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const t = norm(q.trim());
  if (!t) return catalogue;
  const num = Number(t);
  return catalogue.filter((c) => (Number.isInteger(num) && c.numero === num) || norm(c.nom).includes(t));
}

const ETATS: Record<string, string> = {
  brouillon: 'Brouillon',
  inscriptions: 'Inscriptions',
  en_cours: 'En cours',
  pause: 'En pause',
  phase_finale: 'Phase finale',
  terminee: 'Terminée',
};
/** RG-4 : état de la partie en clair. */
export const libelleEtat = (e: string) => ETATS[e] ?? e;

/** Durée restante « 1:29:20 » (ou « 12:05 » sous l'heure). */
export function formatDuree(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
