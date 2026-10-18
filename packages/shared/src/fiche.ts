// RG-5.3 (amendement 2026-10-18) : Fiche Hunter, collecte de profil obligatoire à l'inscription, à la place de l'Examen.
// Les listes sont partagées : app joueur (boutons), API (validation), console (statistiques « Qui est venu »).
import { z } from 'zod';

/** Choix proposés : `id` stocké, `libelle` affiché. */
export interface ChoixFiche {
  id: string;
  libelle: string;
}
const choix = <const T extends readonly ChoixFiche[]>(l: T) => l;

export const TRANCHES_AGE = choix([
  { id: 'moins15', libelle: 'Moins de 15 ans' },
  { id: '15-17', libelle: '15-17 ans' },
  { id: '18-24', libelle: '18-24 ans' },
  { id: '25-34', libelle: '25-34 ans' },
  { id: '35+', libelle: '35 ans et plus' },
]);
export const GENRES = choix([
  { id: 'fille', libelle: 'Fille' },
  { id: 'garcon', libelle: 'Garçon' },
]);
export const OCCUPATIONS = choix([
  { id: 'eleve', libelle: 'Élève' },
  { id: 'etudiant', libelle: 'Étudiant' },
  { id: 'travaille', libelle: 'Je travaille' },
  { id: 'autre', libelle: 'Autre' },
]);
export const VILLES = choix([
  { id: 'douala', libelle: 'Douala' },
  { id: 'yaounde', libelle: 'Yaoundé' },
  { id: 'bafoussam', libelle: 'Bafoussam' },
  { id: 'bamenda', libelle: 'Bamenda' },
  { id: 'garoua', libelle: 'Garoua' },
  { id: 'kribi', libelle: 'Kribi' },
  { id: 'limbe', libelle: 'Limbé' },
  { id: 'buea', libelle: 'Buéa' },
  { id: 'autre', libelle: 'Autre ville' },
]);
export const RESEAUX = choix([
  { id: 'whatsapp', libelle: 'WhatsApp' },
  { id: 'tiktok', libelle: 'TikTok' },
  { id: 'instagram', libelle: 'Instagram' },
  { id: 'facebook', libelle: 'Facebook' },
  { id: 'snapchat', libelle: 'Snapchat' },
  { id: 'youtube', libelle: 'YouTube' },
  { id: 'x', libelle: 'X (Twitter)' },
]);
export const SOURCES = choix([
  { id: 'ami', libelle: 'Un ami' },
  { id: 'tiktok', libelle: 'TikTok' },
  { id: 'instagram', libelle: 'Instagram' },
  { id: 'facebook', libelle: 'Facebook' },
  { id: 'whatsapp', libelle: 'WhatsApp' },
  { id: 'affiche', libelle: 'Une affiche' },
  { id: 'radio_tv', libelle: 'Radio / TV' },
  { id: 'sur_place', libelle: 'Sur place' },
]);

const ids = (l: readonly ChoixFiche[]) => l.map((c) => c.id) as [string, ...string[]];

/**
 * Numéro camerounais normalisé en « +237XXXXXXXXX » (9 chiffres : mobile 6…, fixe 2…), ou null s'il n'est pas valide.
 * Accepte espaces, points, tirets, « 00237 » et « +237 ».
 */
export function telephoneCamerounais(saisie: string): string | null {
  let n = saisie.replace(/[\s.\-()]/g, '');
  if (n.startsWith('+237')) n = n.slice(4);
  else if (n.startsWith('00237')) n = n.slice(5);
  else if (n.length === 12 && n.startsWith('237')) n = n.slice(3);
  return /^[62]\d{8}$/.test(n) ? `+237${n}` : null;
}

/** Profil enregistré (sans le téléphone, gardé à part). */
export interface ProfilJoueur {
  age: string;
  genre: string;
  occupation: string;
  ville: string;
  quartier: string;
  reseaux: string[];
  source: string;
}

/** RG-5.3 : toutes les réponses sont obligatoires ; le téléphone aussi, sauf pour les moins de 15 ans. */
export const FicheHunter = z
  .object({
    age: z.enum(ids(TRANCHES_AGE)),
    genre: z.enum(ids(GENRES)),
    occupation: z.enum(ids(OCCUPATIONS)),
    ville: z.enum(ids(VILLES)),
    quartier: z.string().trim().min(2, 'Indique ton quartier').max(40, 'Quartier trop long'),
    reseaux: z.array(z.enum(ids(RESEAUX))).min(1, 'Choisis au moins un réseau').max(RESEAUX.length),
    source: z.enum(ids(SOURCES)),
    telephone: z.string().max(30).optional(),
    /** Case libre, non cochée par défaut : seuls ceux qui l'ont cochée sont recontactés. */
    accordRecontact: z.boolean().default(false),
  })
  .superRefine((f, ctx) => {
    if (f.age === 'moins15') return;
    if (!f.telephone || !telephoneCamerounais(f.telephone)) ctx.addIssue({ code: 'custom', path: ['telephone'], message: 'Numéro WhatsApp camerounais invalide (9 chiffres, ex. 6 77 12 34 56)' });
  });
export type FicheHunter = z.infer<typeof FicheHunter>;
