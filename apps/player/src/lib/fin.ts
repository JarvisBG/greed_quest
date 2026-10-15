// Page ⑱ : fin de partie (classement final, RG-4.6 / RG-13.5 à 13.7) et abandon (RG-5.7), logique pure.

/** Une ligne du classement final telle que le joueur la lit : ni jenny ni heure des autres. */
export interface LigneFin {
  place: number;
  pseudo: string;
  cartes: number;
  points: number;
  abandon: boolean;
  moi: boolean;
}

/** GET /classement : le classement figé et le détail du joueur. */
export interface Classement {
  partieNom: string;
  designees: number;
  /** Heure de jeu de la fin (ms), null si inconnue. */
  termineeA: number | null;
  /** Gagnant du Clear (RG-13.2), null pour une fin à l'heure. */
  gagnant: string | null;
  lignes: LigneFin[];
  moi: { place: number; cartes: number; points: number; jenny: number; derniereCarteA: number | null; contrefacons: number; abandon: boolean } | null;
}

export type CineFin = { type: 'fin' } | { type: 'abandon' };

export const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

/** Plusieurs joueurs à cette place (ex æquo, RG-13.5). */
export const exaequo = (lignes: readonly LigneFin[], place: number) => lignes.filter((l) => l.place === place).length > 1;

/** Les trois premiers, dans l'ordre du podium de gauche à droite : 2e, 1er, 3e (moins s'il y a moins de joueurs). */
export function podium(lignes: readonly LigneFin[]): { ligne: LigneFin; marche: 1 | 2 | 3 }[] {
  const top = lignes.slice(0, 3).map((ligne, i) => ({ ligne, marche: (i + 1) as 1 | 2 | 3 }));
  return [top[1], top[0], top[2]].filter((x): x is { ligne: LigneFin; marche: 1 | 2 | 3 } => x !== undefined);
}

/** Heure de jeu « 1:41 » (heures:minutes). */
export function heureJeu(ms: number): string {
  const min = Math.floor(ms / 60_000);
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

/** Sous-titre du classement : partie, comment elle a fini, nombre de joueurs classés. */
export const sousTitre = (c: Classement) =>
  `${c.partieNom} · ${c.gagnant ? 'terminée par le Clear' : 'temps écoulé'} · ${c.lignes.length} joueur${c.lignes.length > 1 ? 's' : ''} classé${c.lignes.length > 1 ? 's' : ''}`;

/** La voix du jeu à la fin de la cinématique : comment la partie a fini, puis ta place. */
export function texteFin(c: Classement, pseudo: string): string {
  const debut = c.gagnant
    ? c.gagnant === pseudo
      ? 'Tu as réussi le Clear. La partie est terminée.'
      : `${c.gagnant} a réussi le Clear. La partie est terminée.`
    : 'Le temps est écoulé : personne n’a réussi le Clear.';
  const m = c.moi;
  if (!m) return debut;
  const total = c.lignes.length;
  const fin = m.abandon
    ? `Tu avais quitté la partie, mais tu restes classé : ${ordinal(m.place)} sur ${total}.`
    : m.place === 1
      ? `Tu termines premier sur ${total}. Bravo, Hunter.`
      : `Tu termines ${ordinal(m.place)} sur ${total}.`;
  return `${debut} ${fin}`;
}

/** RG-13.7 : la note sous ta fiche quand une contrefaçon n'a pas compté. */
export function texteContrefacons(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? 'Une contrefaçon de ton Book n’a pas compté : seules les vraies cartes entrent au classement final.'
    : `${n} contrefaçons de ton Book n’ont pas compté : seules les vraies cartes entrent au classement final.`;
}

/** Taille du nom sur sa marche (px) pour qu'il tienne en largeur, de Gon à Tsezguerra. */
export const tailleNom = (nom: string, largeur: number, max: number) => Math.max(12, Math.min(max, largeur / (Math.max(1, nom.length) * 0.82)));

/** Refus d'une action après la fin ou l'abandon, en clair (RG-7.4). */
export const texteFerme = (termine: boolean) =>
  termine ? 'La partie est terminée : plus aucune action n’est possible.' : 'Tu as quitté la partie : tu ne peux plus agir, seulement suivre.';

/** La cinématique de fin n'est jouée qu'une fois par joueur (elle revient si l'app s'ouvre après la fin). */
export const cleFinVue = (partieId: string, joueurId: string) => `gq-fin-vue-${partieId}-${joueurId}`;
