// Inscription (RG-5) : Examen Hunter, test de Nen, kit de départ, rattrapage des retardataires.
// Le contenu des questionnaires est provisoire (REGLES.md « Points ouverts ») : à remplacer par le texte définitif.
import { SPELL_TYPES, type NenType, type SpellType } from '@gq/shared';
import { pick, type Rng } from './rng.js';

export interface QuizQuestion {
  id: string;
  texte: string;
  choix: readonly string[];
}

/** RG-5.3 : 3 questions, non bloquant, bonne réponse = bonus jenny. */
export const EXAMEN: readonly (QuizQuestion & { bonne: number })[] = [
  { id: 'e1', texte: 'Combien de temps faut-il attendre entre deux scans ?', choix: ['10 secondes', '30 secondes', '2 minutes'], bonne: 1 },
  {
    id: 'e2',
    texte: 'Que fait la carte Mur défensif gardée dans ton Book ?',
    choix: ['Elle annule le prochain sort offensif reçu', 'Elle double tes gains', 'Elle gèle un joueur proche'],
    bonne: 0,
  },
  { id: 'e3', texte: 'Une carte reçue en échange peut-elle être une contrefaçon ?', choix: ['Oui', 'Non'], bonne: 0 },
];

/** Types attribués par le questionnaire ; la Spécialisation est tirée à part (RG-5.4, rare). */
const NEN_QUIZ_TYPES: readonly NenType[] = ['renforcement', 'emission', 'transformation', 'materialisation', 'manipulation'];

/** RG-5.4 : 5 questions ; le choix n°i vaut un point pour NEN_QUIZ_TYPES[i]. */
export const NEN_TEST: readonly QuizQuestion[] = [
  {
    id: 'n1',
    texte: 'Devant un coffre verrouillé, tu…',
    choix: ['le forces', 'le fais ouvrir de loin par un complice', 'te fais passer pour son propriétaire', 'fabriques une clé', 'convaincs le gardien de l’ouvrir'],
  },
  {
    id: 'n2',
    texte: 'Ton atout dans une équipe :',
    choix: ['la force', 'la portée', 'la ruse', 'l’inventivité', 'l’influence'],
  },
  {
    id: 'n3',
    texte: 'Ton arme idéale :',
    choix: ['tes poings', 'un arc', 'un masque', 'un outil fait sur mesure', 'une marionnette'],
  },
  {
    id: 'n4',
    texte: 'Un rival te barre la route, tu…',
    choix: ['fonces', 'l’évites de loin', 'le bluffes', 'construis un détour', 'le fais changer d’avis'],
  },
  {
    id: 'n5',
    texte: 'On te décrit plutôt comme…',
    choix: ['direct et honnête', 'impatient', 'farceur', 'méticuleux', 'logique et déterminé'],
  },
];

/** Nombre de bonnes réponses à l'Examen (réponses manquantes = fausses). */
export function scoreExamen(reponses: readonly number[]): number {
  return EXAMEN.filter((q, i) => reponses[i] === q.bonne).length;
}

export function validQuizAnswers(questions: readonly QuizQuestion[], reponses: readonly number[]): boolean {
  return (
    reponses.length === questions.length &&
    reponses.every((r, i) => Number.isInteger(r) && r >= 0 && r < (questions[i]?.choix.length ?? 0))
  );
}

/**
 * RG-5.4 : Spécialisation avec la probabilité `specialisationPct` ; sinon le type le plus choisi,
 * égalité départagée au hasard.
 */
export function nenFromAnswers(reponses: readonly number[], specialisationPct: number, rng: Rng): NenType {
  if (rng.next() * 100 < specialisationPct) return 'specialisation';
  const points = NEN_QUIZ_TYPES.map((_, i) => reponses.filter((r) => r === i).length);
  const max = Math.max(...points);
  return pick(rng, NEN_QUIZ_TYPES.filter((_, i) => points[i] === max));
}

/** RG-5.5 : sort du kit, « de rareté commune » ; rareté des sorts non définie → uniforme. */
export function kitSpell(rng: Rng): SpellType {
  // Regard est un sort rare : jamais dans le kit.
  // Kit : jamais Voyance, Clairvoyance ni Accompagnement (sorts rares ou trop forts au départ, amendement 2026-10-10).
  return pick(rng, SPELL_TYPES.filter((s) => s !== 'regard' && s !== 'clairvoyance' && s !== 'accompagnement'));
}

/** RG-5.6 : bonus de rattrapage proportionnel au temps de jeu écoulé (0 si désactivé). */
export function catchUpBonus(heureJeu: number, jParMin: number): number {
  return Math.max(0, Math.floor(heureJeu / 60_000) * jParMin);
}
