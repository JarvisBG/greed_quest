// Ce que l'écran dit, en clair et en français : faits du fil, évènements, chrono, classement.
import type { Rank } from '@gq/shared';
import type { EntreeFil, EvenementEcran, LigneClassement } from './types';

/** Noms des sorts dans l'anime (traduction française, comme l'app joueur). */
const SORTS: Record<string, string> = {
  vol: 'Vol', pickpocket: 'Pickpocket', echange_force: 'Échange', gel: 'Gel', barriere: 'Mur défensif', radar: 'Trace',
  revelation: 'Guide', duplication: 'Mimétisme', analyse: 'Pénétration', regard: 'Voyance', clairvoyance: 'Clairvoyance',
  accompagnement: 'Accompagnement', retour: 'Retour',
};
const nomSort = (s: string) => SORTS[s] ?? s;
const RESULTATS: Record<string, string> = { reussi: 'réussi', bloque: 'bloqué', sans_effet: 'sans effet' };

/** Un fait du fil, prêt à montrer : la phrase, une onomatopée (sans carte) ou la carte illustrée. */
export interface Fait {
  texte: string;
  /** Onomatopée jaune au-dessus de la boîte du jeu (quand il n'y a pas de carte à montrer). */
  mot: string | null;
  rang: Rank | null;
  carte: { numero: number | null; nom: string; rang: Rank; limite: number | null; texte: string | null } | null;
  /** Carte de Maître du jeu : filet d'or. */
  gm: boolean;
}

export function fait(e: EntreeFil): Fait {
  const base = { mot: null, rang: null, carte: null, gm: false };
  switch (e.type) {
    case 'tirage':
    case 'arene':
      return {
        ...base,
        texte: e.type === 'tirage' ? `${e.pseudo} a tiré « ${e.carte} »` : `${e.pseudo} gagne à l'arène : « ${e.carte} »`,
        rang: e.rang,
        carte: { numero: e.numero ?? null, nom: e.carte, rang: e.rang, limite: e.limite ?? null, texte: e.texte ?? null },
      };
    case 'sort': {
      const nom = nomSort(e.sort);
      // Amendement 2026-10-09 : Voyance et Clairvoyance restent anonymes.
      if (!e.lanceur) return { ...base, texte: `Quelqu'un a utilisé ${nom}`, mot: nom.toUpperCase() };
      const mot = e.sort === 'vol' && e.resultat === 'reussi' ? 'VOL !' : nom.toUpperCase();
      return { ...base, texte: `${e.lanceur} a lancé ${nom}${e.cible ? ` sur ${e.cible}` : ''} : ${RESULTATS[e.resultat] ?? e.resultat}`, mot };
    }
    case 'echange':
      return { ...base, texte: `Échange de cartes rares entre ${e.joueurs[0]} et ${e.joueurs[1]}`, mot: 'ÉCHANGE' };
    case 'carte_gm':
      if ('carte' in e) return { ...base, gm: true, mot: 'JARVIS', texte: `Jarvis a parlé : ${e.lanceur} reçoit « ${e.carte} »` };
      if ('cible' in e) return { ...base, gm: true, mot: 'SCEAU', texte: `${e.lanceur} a scellé le Book de ${e.cible}` };
      return { ...base, gm: true, mot: 'GM', texte: `${e.pseudo} a trouvé une carte de Maître du jeu` };
    case 'carte_gm_obtenue':
      return { ...base, gm: true, mot: 'GM', texte: `${e.pseudo} reçoit une carte de Maître du jeu` };
    case 'raid':
      return e.reussi
        ? { ...base, mot: 'VICTOIRE', texte: `La Brigade est vaincue : ${e.frappeurs} Hunter${e.frappeurs > 1 ? 's' : ''} récompensé${e.frappeurs > 1 ? 's' : ''}` }
        : { ...base, mot: 'RAID', texte: "La Brigade s'est enfuie" };
  }
}

/** Ligne de la boîte du jeu (bas de l'écran). */
export const ligneAnnonce = (e: EntreeFil) => {
  const f = fait(e);
  return f.rang ? `${f.texte} · rang ${f.rang}` : f.texte;
};

/** Tirage ou arène de rang S ou SS : cinématique. */
export const estCarteRare = (e: EntreeFil): e is Extract<EntreeFil, { type: 'tirage' | 'arene' }> =>
  (e.type === 'tirage' || e.type === 'arene') && (e.rang === 'S' || e.rang === 'SS');

export const ilYa = (minutes: number) => (minutes < 1 ? "à l'instant" : `il y a ${minutes} min`);

/** Chrono : « 1:24:10 » ou « 09:32 ». */
export function chrono(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Étiquette d'un évènement (habillage du haut, case qui claque) ; la carte maudite est en noir. */
export function etiquette(e: Pick<EvenementEcran, 'type'>): { titre: string; maudite: boolean } {
  switch (e.type) {
    case 'apparition':
      return { titre: 'Apparition', maudite: false };
    case 'double_gain':
      return { titre: 'Double gain', maudite: false };
    case 'zone_maudite':
      return { titre: 'Zone maudite', maudite: true };
    case 'krach':
      return { titre: 'Krach', maudite: false };
    case 'carte_maudite':
      return { titre: 'Une carte maudite circule', maudite: true };
    case 'raid':
      return { titre: 'Raid de la Brigade', maudite: false };
    default:
      return { titre: 'Évènement', maudite: false };
  }
}

/** Phrase de la voix off (enregistrée, public/voix/index.json) quand l'évènement commence. */
export const phraseEvenement: Partial<Record<EvenementEcran['type'], string>> = {
  apparition: 'Évènement ! Une apparition !',
  double_gain: 'Évènement ! Double gain !',
  zone_maudite: 'Évènement ! Une zone est maudite !',
  krach: 'Évènement ! Krach de Masadora !',
  carte_maudite: 'Évènement ! Une carte maudite circule !',
};

/** Ordre de la course : cartes, puis points (comme le classement de l'API, RG-13). */
export const trier = (l: readonly LigneClassement[]) => [...l].sort((a, b) => b.cartes - a.cartes || b.points - a.points || a.place - b.place);

/**
 * Dépassement dans le haut du classement (8 couloirs) : le joueur qui a gagné le plus de places, et s'il prend la tête.
 * Rien si personne n'a doublé (nouvel arrivant ou recul seulement).
 */
export function depassement(avant: readonly LigneClassement[], apres: readonly LigneClassement[]): { pseudo: string; tete: boolean } | null {
  const a = trier(avant).slice(0, 8).map((l) => l.pseudo);
  const b = trier(apres).slice(0, 8).map((l) => l.pseudo);
  let mieux: { pseudo: string; gain: number; i: number } | null = null;
  b.forEach((p, i) => {
    const j = a.indexOf(p);
    if (j === -1) return;
    const gain = j - i;
    if (gain > 0 && (!mieux || gain > mieux.gain)) mieux = { pseudo: p, gain, i };
  });
  const m = mieux as { pseudo: string; gain: number; i: number } | null;
  return m ? { pseudo: m.pseudo, tete: m.i === 0 } : null;
}

/** Titre du duel de tête. */
export function titreDuel(a: LigneClassement, b: LigneClassement): string {
  const e = a.cartes - b.cartes;
  if (e === 0) return 'À égalité !';
  if (e <= 1) return 'Au coude à coude';
  return e >= 4 ? `${a.pseudo} s'envole` : `${a.pseudo} mène la course`;
}
