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
