// Questions du Raid de la Brigade (RG-12). Contenu provisoire, à remplacer par le texte définitif.
import type { QuizQuestion } from './registration.js';

export const RAID_QUESTIONS: readonly (QuizQuestion & { bonne: number })[] = [
  { id: 'r1', texte: 'Combien de cartes désignées compte le Livre ?', choix: ['20', '30', '50'], bonne: 1 },
  { id: 'r2', texte: 'Quel rang est le plus rare ?', choix: ['S', 'SS', 'A'], bonne: 1 },
  { id: 'r3', texte: 'Combien de sorts contient un paquet de Masadora ?', choix: ['1', '3', '5'], bonne: 1 },
  { id: 'r4', texte: 'Combien de temps dure l’immunité après un sort subi ?', choix: ['2 min', '5 min', '10 min'], bonne: 1 },
  { id: 'r5', texte: 'Que révèle le sort Analyse ?', choix: ['La position d’un joueur', 'Les contrefaçons d’une page', 'Une balise rare'], bonne: 1 },
  { id: 'r6', texte: 'Peut-on revendre une carte SS ?', choix: ['Oui', 'Non'], bonne: 1 },
  { id: 'r7', texte: 'Où se déroulent les enchères ?', choix: ['Masadora', 'Antokiba', 'Soufrabi'], bonne: 1 },
  { id: 'r8', texte: 'Combien d’emplacements libres compte le Livre ?', choix: ['10', '15', '30'], bonne: 1 },
  { id: 'r9', texte: 'Quel sort se déclenche tout seul ?', choix: ['Barrière', 'Radar', 'Vol'], bonne: 0 },
  { id: 'r10', texte: 'Combien de temps faut-il attendre entre deux échanges avec le même joueur ?', choix: ['1 min', '10 min', '30 min'], bonne: 1 },
];
