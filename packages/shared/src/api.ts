// Schémas Zod des requêtes (intentions) échangées entre les fronts et l'API (P1 : jamais de résultat envoyé par le client).
import { z } from 'zod';

export const StaffLogin = z.object({ code: z.string().min(4, 'Code trop court') });
export type StaffLogin = z.infer<typeof StaffLogin>;

export const StaffCreate = z.object({
  nom: z.string().trim().min(1, 'Nom requis').max(40),
  role: z.enum(['pnj', 'gm']),
  code: z.string().min(6, 'Code d’au moins 6 caractères'),
});
export type StaffCreate = z.infer<typeof StaffCreate>;

export const PartieCreate = z.object({
  nom: z.string().trim().min(1).max(80),
  /** Préréglage de paramètres (RG-14.5). */
  prereglage: z.string().default('standard'),
  /** Remplit la partie avec les données de démonstration (catalogue, zones, balises). */
  demo: z.boolean().default(false),
  gm: z.object({ nom: z.string().trim().min(1).max(40), code: z.string().min(6, 'Code d’au moins 6 caractères') }),
});
export type PartieCreate = z.infer<typeof PartieCreate>;

/** Position envoyée par le téléphone (RG-10.9) ; l'heure est fixée par le serveur. */
export const PositionInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisionM: z.number().min(0),
});
export type PositionInput = z.infer<typeof PositionInput>;

/** RG-5.1 : `appareilId` est un identifiant aléatoire généré et gardé par l'app (1 appareil = 1 joueur). */
export const Inscription = z.object({
  pseudo: z.string().trim().min(2, 'Pseudo trop court').max(20, 'Pseudo trop long'),
  appareilId: z.string().min(16).max(100),
  position: PositionInput,
});
export type Inscription = z.infer<typeof Inscription>;

export const Reconnexion = z.object({ appareilId: z.string().min(16).max(100) });

export const ReponsesQuiz = z.object({ reponses: z.array(z.number().int().min(0)).max(10) });

/** RG-5.2 : licence scannée par un PNJ ou le GM. */
export const LicenceScan = z.object({ qr: z.string().min(10).max(200) });

/** RG-7 : « j'ai scanné cette balise, ici ». `scanneA` (heure réelle du téléphone, ms) pour un scan mis en file hors ligne (RG-7.5). */
export const ScanIntent = z.object({
  baliseId: z.string().min(1).max(100),
  position: PositionInput,
  scanneA: z.number().int().positive().optional(),
});
export type ScanIntent = z.infer<typeof ScanIntent>;

/** RG-10 : lancement d'un sort. `itemId` = la carte de sort du Livre ; la position accompagne chaque sort (RG-10.9). */
const SourceSort = z.union([
  z.object({ type: z.literal('carte'), itemId: z.string() }),
  /** Manipulation : 1 échange forcé gratuit par partie (RG-5.4). */
  z.object({ type: z.literal('pouvoir') }),
]);
export const SortIntent = z.discriminatedUnion('sort', [
  z.object({
    sort: z.enum(['vol', 'gel']),
    source: SourceSort,
    cibleId: z.string(),
    /** Émission : viser une fois hors de portée (RG-10.1). */
    emission: z.boolean().optional(),
    position: PositionInput,
  }),
  z.object({
    sort: z.literal('echange_force'),
    source: SourceSort,
    cibleId: z.string(),
    emission: z.boolean().optional(),
    carteDonneeId: z.string(),
    position: PositionInput,
  }),
  z.object({ sort: z.literal('radar'), itemId: z.string(), cibleId: z.string(), position: PositionInput }),
  z.object({ sort: z.literal('revelation'), itemId: z.string(), position: PositionInput }),
  z.object({ sort: z.literal('duplication'), itemId: z.string(), carteItemId: z.string(), position: PositionInput }),
  z.object({ sort: z.literal('analyse'), itemId: z.string(), page: z.number().int().min(1), position: PositionInput }),
  z.object({ sort: z.literal('barriere'), itemId: z.string(), position: PositionInput }),
]);
export type SortIntent = z.infer<typeof SortIntent>;

/** RG-5.4 Transformation : Texture Surprise. */
export const TransformationIntent = z.object({ itemId: z.string(), cibleCarteId: z.string() });

/** RG-9.2 : achat d'un paquet, avec le QR de la boutique scanné sur place. */
export const AchatIntent = z.object({ qr: z.string().min(1).max(100), position: PositionInput });
/** RG-9.4 : revente d'une carte à Masadora. */
export const ReventeIntent = z.object({ qr: z.string().min(1).max(100), itemId: z.string(), position: PositionInput });

/** RG-11.1 amendé : proposer un échange à un joueur à portée. */
export const EchangeProposition = z.object({ cibleId: z.string(), position: PositionInput });
export const EchangeReponse = z.object({ accepte: z.boolean() });
/** Sa part de l'échange : cartes de son Livre et/ou jenny. */
export const EchangeOffre = z.object({ itemIds: z.array(z.string()).max(30), jenny: z.number().int().min(0) });

/** RG-11.4 : un PNJ met une carte aux enchères. */
export const EnchereOuverture = z.object({ carteId: z.string(), prixDepart: z.number().int().min(1).default(1) });
/** RG-11.4 : participer exige le QR de l'enchère, scanné sur place. */
export const EnchereInscription = z.object({ qr: z.string().min(1).max(100), position: PositionInput });
export const EnchereOffre = z.object({ montant: z.number().int().min(1) });

// --- Console GM / PNJ (RG-3) ---

/** RG-4 : actions du GM sur le cycle de vie. */
export const CycleIntent = z.object({
  action: z.enum(['ouvrir_inscriptions', 'demarrer', 'pause', 'reprendre', 'phase_finale', 'terminer', 'fermer_inscriptions']),
  motif: z.string().max(200).optional(),
});

/** RG-14.2 : réglage d'un paramètre. */
export const ParamSettingInput = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({ mode: z.literal('verrouille'), value: z.number().min(0) }),
  z.object({ mode: z.literal('multiplicateur'), coef: z.number().min(0).max(10) }),
]);
export const ParamIntent = z.object({ cle: z.string(), reglage: ParamSettingInput });

export const PrereglageCreation = z.object({ nom: z.string().trim().min(1).max(60), description: z.string().max(200).default('') });
export const PrereglageApplication = z.object({ id: z.string() });

/** RG-6 : le GM active, coupe ou endort une balise. */
export const BaliseEtatIntent = z.object({ action: z.enum(['activer', 'couper', 'endormir']), motif: z.string().max(200).optional() });

const LatLngInput = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const ZoneCreation = z.object({
  nom: z.string().trim().min(1).max(40),
  type: z.enum(['masadora', 'antokiba', 'soufrabi', 'sauvage']),
  polygone: z.array(LatLngInput).min(3),
});
export const BaliseCreation = z.object({ zoneId: z.string(), libelle: z.string().trim().min(1).max(20), position: LatLngInput.optional() });
/** RG-8.1 : carte du catalogue (nom, lot réel). */
export const CarteModification = z.object({ nom: z.string().trim().min(1).max(60).optional(), lotReel: z.string().max(120).nullable().optional() });

/** RG-12 : lancement d'un événement par le GM. */
export const EvenementIntent = z.object({
  type: z.enum(['apparition', 'double_gain', 'zone_maudite', 'raid', 'krach', 'carte_maudite', 'mission_secrete']),
  zoneId: z.string().optional(),
  /** Durée en minutes (sinon celle du tableau RG-12). */
  dureeMin: z.number().min(1).max(120).optional(),
  joueurId: z.string().optional(),
  objectif: z.string().max(200).optional(),
  recompenseJenny: z.number().int().min(0).optional(),
});
export const RaidReponse = z.object({ questionId: z.string(), choix: z.number().int().min(0) });

// --- Sanctions et corrections (RG-3.1 : motif obligatoire, RG-15) ---
const Motif = z.string().trim().min(3, 'Motif obligatoire').max(200);
export const AvertissementIntent = z.object({ joueurId: z.string(), motif: Motif });
export const GelSanctionIntent = z.object({ joueurId: z.string(), motif: Motif });
/** RG-15 photo de balise : gains de cette balise annulés + gel 5 min. */
export const AnnulationGainsIntent = z.object({ joueurId: z.string(), baliseId: z.string(), motif: Motif });
export const DisqualificationIntent = z.object({ joueurId: z.string(), motif: Motif });
export const CorrectionLivreIntent = z.object({
  joueurId: z.string(),
  ajouterCarteId: z.string().optional(),
  retirerItemId: z.string().optional(),
  motif: Motif,
});
export const CorrectionJennyIntent = z.object({ joueurId: z.string(), delta: z.number().int(), motif: Motif });

// --- Checkpoints PNJ et expertise ---
export const CheckpointCreation = z.object({
  zoneId: z.string(),
  defi: z.string().trim().min(1).max(200),
  cartes: z.array(z.string()).max(50).default([]),
  arbitreId: z.string().optional(),
});
/** Le PNJ scanne la licence du joueur qui a réussi le défi, et donne une carte du checkpoint et/ou des jenny. */
export const CheckpointReussite = z.object({ licence: z.string(), carteId: z.string().optional(), jenny: z.number().int().min(0).max(500).default(0) });
/** RG-8.8 : expertise à Antokiba, payée par le joueur (licence scannée par le PNJ). */
export const ExpertiseIntent = z.object({ licence: z.string(), page: z.number().int().min(1).optional() });
/** Arène de Soufrabi (amendement 2026-10-09) : le PNJ scanne la licence, le joueur paie la mise. */
export const AreneEntree = z.object({ licence: z.string() });
/** Issue du défi, arbitrée par le PNJ. */
export const AreneIssue = z.object({ victoire: z.boolean() });
/** Entrée enregistrée par erreur : mise remboursée, motif obligatoire (RG-3.1). */
export const AreneAnnulation = z.object({ motif: Motif });

// --- Clear (RG-13) ---
/** RG-13.2 : le GM scanne la licence du joueur dont le Livre est gelé. */
export const ClearConfirmation = z.object({ licence: z.string() });
export const ClearAnnulation = z.object({ joueurId: z.string(), motif: z.string().trim().min(3, 'Motif obligatoire').max(200) });
/** RG-13.3 : 3 cartes désignées choisies par le gagnant. */
export const RecompensesIntent = z.object({ itemIds: z.array(z.string()).length(3, 'Choisis exactement 3 cartes') });
