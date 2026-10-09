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
