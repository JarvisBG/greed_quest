// RG-5.4 (amendements 2026-10-10) : état du pouvoir de Nen à afficher sur l'accueil, d'après `/moi`.
// Chaque type a son délai : `pouvoir` (Renforcement, Émission, Manipulation), `transformation` (Texture Surprise),
// `reserve` (tirage bonus de Matérialisation, donné tout seul), `specialisation` (+ Zetsu actif, Fortune armée).
import { NENS, POUVOIRS_SPE } from './format';
import type { Moi } from './useJeu';

export interface EtatPouvoir {
  nom: string;
  effet: string;
  /** `pret` : utilisable ; `recharge` : attendre `resteMs` ; `actif` : en cours (Zetsu, Fortune) ; `auto` : arrive tout seul. */
  etat: 'pret' | 'recharge' | 'actif' | 'auto';
  resteMs: number;
  /** Phrase d'état, sans le temps (affiché à part). */
  libelle: string;
}

type MoiPouvoir = Pick<Moi, 'nen' | 'pouvoirSpe' | 'delais' | 'specialisation'>;

/** `ecoule` : temps écoulé depuis la réception de `/moi` (les délais sont donnés à cet instant). */
export function etatPouvoir(moi: MoiPouvoir, ecoule: number): EtatPouvoir | null {
  if (!moi.nen) return null;
  const reste = (ms: number | null) => Math.max(0, (ms ?? 0) - ecoule);
  const n = NENS[moi.nen];
  const recharge = (ms: number | null, pret: string): Pick<EtatPouvoir, 'etat' | 'resteMs' | 'libelle'> =>
    reste(ms) > 0 ? { etat: 'recharge', resteMs: reste(ms), libelle: 'Se recharge' } : { etat: 'pret', resteMs: 0, libelle: pret };

  switch (moi.nen) {
    case 'renforcement':
      return { nom: n.nom, effet: n.passif, ...recharge(moi.delais.pouvoir, 'Prêt : il annulera le prochain sort offensif reçu') };
    case 'emission':
    case 'manipulation':
      return { nom: n.nom, effet: n.passif, ...recharge(moi.delais.pouvoir, 'Prêt, dans l’écran des sorts') };
    case 'transformation':
      return { nom: n.nom, effet: n.passif, ...recharge(moi.delais.transformation, 'Texture Surprise prête, dans l’écran des sorts') };
    case 'materialisation':
      return { nom: n.nom, effet: n.passif, etat: 'auto', resteMs: reste(moi.delais.reserve), libelle: 'Prochain tirage bonus' };
    case 'specialisation': {
      if (!moi.pouvoirSpe) return { nom: n.nom, effet: n.passif, etat: 'pret', resteMs: 0, libelle: 'Réponds à la question de Wing' };
      const spe = POUVOIRS_SPE[moi.pouvoirSpe];
      if (moi.pouvoirSpe === 'zetsu' && reste(moi.specialisation.zetsu) > 0)
        return { nom: spe.nom, effet: spe.effet, etat: 'actif', resteMs: reste(moi.specialisation.zetsu), libelle: 'Zetsu : tu es invisible' };
      if (moi.pouvoirSpe === 'fortune' && moi.specialisation.fortuneArmee)
        return { nom: spe.nom, effet: spe.effet, etat: 'actif', resteMs: 0, libelle: 'Armée : ton prochain scan donne un gain de plus' };
      return { nom: spe.nom, effet: spe.effet, ...recharge(moi.delais.specialisation, 'Prêt, dans l’écran des sorts') };
    }
  }
}
