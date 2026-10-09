// Schéma de la base (entités de docs/REGLES.md « Entités »).
// Heures « de jeu » : ms d'horloge de jeu (gameClock, integer). Heures réelles : ms epoch (bigint) ou timestamptz.
import type { GameState, NenType, PlayerStatus, Rank, SpellType, BeaconState, BeaconType } from '@gq/shared';
import type { EventData, GameEvent, JState, Origine, Faux, ParamKey, ParamSetting, ParamSettings, Perte, Position, Polygon } from '@gq/engine';
import { bigint, boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const heureJeu = (nom: string) => integer(nom);
const heureReelle = (nom: string) => bigint(nom, { mode: 'number' });

/** RG-14.5 : préréglages (système + enregistrés par un GM). */
export const prereglages = pgTable('prereglages', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  description: text('description').notNull().default(''),
  systeme: boolean('systeme').notNull().default(false),
  reglages: jsonb('reglages').$type<Partial<Record<ParamKey, ParamSetting>>>().notNull(),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
});

/** Partie : état (RG-4), horaires, paramètres (RG-14), zone de jeu. */
export const parties = pgTable('parties', {
  id: text('id').primaryKey(),
  nom: text('nom').notNull(),
  etat: text('etat').$type<GameState>().notNull().default('brouillon'),
  etatAvantPause: text('etat_avant_pause').$type<'en_cours' | 'phase_finale'>(),
  inscriptionsOuvertes: boolean('inscriptions_ouvertes').notNull().default(false),
  demarreeA: heureReelle('demarree_a'),
  pauseDepuis: heureReelle('pause_depuis'),
  pauseCumulee: heureReelle('pause_cumulee').notNull().default(0),
  termineeA: heureJeu('terminee_a'),
  parametres: jsonb('parametres').$type<ParamSettings>().notNull(),
  /** RG-14.1 : J lissé. */
  j: jsonb('j').$type<JState>().notNull().default({ value: 0, lastDecreaseAt: null }),
  /** Contour du terrain (sortie de zone, RG-15). */
  perimetre: jsonb('perimetre').$type<Polygon>(),
  /** Graine du générateur aléatoire de la partie (reproductibilité des tests). */
  graine: integer('graine').notNull().default(0),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
});

export type ZoneType = 'masadora' | 'antokiba' | 'soufrabi' | 'sauvage';

/** Zone : Masadora (boutique), Antokiba (enchères, expertise), Soufrabi (arène), zones sauvages. */
export const zones = pgTable('zones', {
  id: text('id').primaryKey(),
  partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
  nom: text('nom').notNull(),
  type: text('type').$type<ZoneType>().notNull(),
  polygone: jsonb('polygone').$type<Polygon>().notNull(),
});

/** Carte du catalogue (RG-8.1) : numéro 001..N, rang, lot réel. */
export const cartes = pgTable(
  'cartes',
  {
    id: text('id').primaryKey(),
    partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
    numero: integer('numero').notNull(),
    nom: text('nom').notNull(),
    rang: text('rang').$type<Rank>().notNull(),
    designee: boolean('designee').notNull().default(true),
    lotReel: text('lot_reel'),
  },
  (t) => [uniqueIndex('cartes_partie_numero').on(t.partieId, t.numero)],
);

/** Joueur (RG-5) : une ligne par partie, liée à un appareil. */
export const joueurs = pgTable(
  'joueurs',
  {
    id: text('id').primaryKey(),
    partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
    pseudo: text('pseudo').notNull(),
    appareilId: text('appareil_id').notNull(),
    /** Secret de la licence QR tournante (RG-5.2). */
    licenceSecret: text('licence_secret').notNull(),
    nen: text('nen').$type<NenType>(),
    jenny: integer('jenny').notNull().default(0),
    statut: text('statut').$type<PlayerStatus>().notNull().default('actif'),
    position: jsonb('position').$type<Position>(),
    derniereActionA: heureJeu('derniere_action_a'),
    geleJusqua: heureJeu('gele_jusqua'),
    immuniteJusqua: heureJeu('immunite_jusqua'),
    dernierOffensifA: heureJeu('dernier_offensif_a'),
    pouvoirsUtilises: jsonb('pouvoirs_utilises').$type<('renforcement' | 'emission' | 'manipulation')[]>().notNull().default([]),
    transformationDispoA: heureJeu('transformation_dispo_a'),
    /** RG-7.1 / 7.2 : balises des tirages réussis, du plus ancien au plus récent. */
    historiqueTirages: jsonb('historique_tirages').$type<string[]>().notNull().default([]),
    dernierTirageA: heureJeu('dernier_tirage_a'),
    inscritA: heureJeu('inscrit_a').notNull().default(0),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('joueurs_partie_pseudo').on(t.partieId, t.pseudo), // RG-5.1
    uniqueIndex('joueurs_partie_appareil').on(t.partieId, t.appareilId), // RG-5.1
  ],
);

/** Livre (RG-8.5) : le contenu est dans exemplaires / sorts / pertes ; ici l'état du Livre lui-même. */
export const livres = pgTable('livres', {
  joueurId: text('joueur_id').primaryKey().references(() => joueurs.id, { onDelete: 'cascade' }),
  /** RG-13.1 : Clear provisoire, Livre gelé. */
  gele: boolean('gele').notNull().default(false),
  geleA: heureJeu('gele_a'),
});

/** Exemplaire d'une carte (RG-8.4, 8.6, 8.14). */
export const exemplaires = pgTable(
  'exemplaires',
  {
    id: text('id').primaryKey(),
    partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
    joueurId: text('joueur_id').notNull().references(() => joueurs.id, { onDelete: 'cascade' }),
    /** Carte affichée (pour une contrefaçon : la carte imitée). */
    carteId: text('carte_id').notNull().references(() => cartes.id),
    origine: jsonb('origine').$type<Origine>().notNull(),
    obtenuA: heureJeu('obtenu_a').notNull(),
    faux: jsonb('faux').$type<Faux>(),
    marque: text('marque').$type<'creee' | 'demasquee'>(),
    maudite: boolean('maudite').notNull().default(false),
  },
  (t) => [index('exemplaires_joueur').on(t.joueurId), index('exemplaires_partie').on(t.partieId)],
);

/** Sort (RG-10) : type, propriétaire, utilisé. */
export const sorts = pgTable(
  'sorts',
  {
    id: text('id').primaryKey(),
    partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
    joueurId: text('joueur_id').notNull().references(() => joueurs.id, { onDelete: 'cascade' }),
    type: text('type').$type<SpellType>().notNull(),
    obtenuA: heureJeu('obtenu_a').notNull(),
    utilise: boolean('utilise').notNull().default(false),
    utiliseA: heureJeu('utilise_a'),
  },
  (t) => [index('sorts_joueur').on(t.joueurId)],
);

/** RG-8.13 : traces des cartes perdues. */
export const pertes = pgTable(
  'pertes',
  {
    id: serial('id').primaryKey(),
    joueurId: text('joueur_id').notNull().references(() => joueurs.id, { onDelete: 'cascade' }),
    carteId: text('carte_id').notNull(),
    cause: text('cause').$type<Perte['cause']>().notNull(),
    par: text('par'),
    a: heureJeu('a').notNull(),
  },
  (t) => [index('pertes_joueur').on(t.joueurId)],
);

/** Balise (RG-6) : l'id est imprimé dans le QR, non devinable (RG-6.1). */
export const balises = pgTable(
  'balises',
  {
    id: text('id').primaryKey(),
    partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
    zoneId: text('zone_id').notNull().references(() => zones.id),
    /** Repère pour l'équipe (étiquette au dos, plan de pose). Jamais envoyé aux joueurs. */
    libelle: text('libelle').notNull(),
    type: text('type').$type<BeaconType>(),
    etat: text('etat').$type<BeaconState>().notNull().default('dormante'),
    stock: integer('stock').notNull().default(0),
    epuiseeA: heureJeu('epuisee_a'),
    /** Position de pose (GM seulement). */
    position: jsonb('position').$type<{ lat: number; lng: number }>(),
  },
  (t) => [index('balises_partie').on(t.partieId)],
);

/** Membre de l'équipe : PNJ ou GM (RG-3). */
export const staff = pgTable('staff', {
  id: text('id').primaryKey(),
  partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
  nom: text('nom').notNull(),
  role: text('role').$type<'pnj' | 'gm'>().notNull(),
  /** Empreinte du code d'accès. */
  codeHash: text('code_hash').notNull(),
});

/** Checkpoint PNJ : arbitre, zone, défi, cartes à distribuer. */
export const checkpoints = pgTable('checkpoints', {
  id: text('id').primaryKey(),
  partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
  zoneId: text('zone_id').notNull().references(() => zones.id),
  arbitreId: text('arbitre_id').references(() => staff.id),
  defi: text('defi').notNull(),
  /** Cartes que le PNJ peut donner (ids du catalogue, un par exemplaire). */
  cartes: jsonb('cartes').$type<string[]>().notNull().default([]),
});

/** Événement GM (RG-12). */
export const evenements = pgTable(
  'evenements',
  {
    id: text('id').primaryKey(),
    partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
    zoneId: text('zone_id'),
    debut: heureJeu('debut').notNull(),
    fin: heureJeu('fin').notNull(),
    etat: text('etat').$type<GameEvent['etat']>().notNull(),
    reussi: boolean('reussi'),
    data: jsonb('data').$type<EventData>().notNull(),
    lancePar: text('lance_par'),
  },
  (t) => [index('evenements_partie').on(t.partieId)],
);

export type ActeurType = 'joueur' | 'pnj' | 'gm' | 'systeme';

/** Journal (RG-3.1, P5) : chaque action d'état y écrit une ligne, dans la même transaction. */
export const journal = pgTable(
  'journal',
  {
    id: serial('id').primaryKey(),
    partieId: text('partie_id').notNull().references(() => parties.id, { onDelete: 'cascade' }),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    heureJeu: heureJeu('heure_jeu').notNull(),
    acteurType: text('acteur_type').$type<ActeurType>().notNull(),
    acteurId: text('acteur_id'),
    action: text('action').notNull(),
    resultat: text('resultat').notNull(),
    motif: text('motif'),
    details: jsonb('details').$type<Record<string, unknown>>(),
  },
  (t) => [index('journal_partie').on(t.partieId, t.id)],
);
