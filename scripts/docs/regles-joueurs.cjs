// Règles du jeu pour les joueurs de Greed Island (Word), d'après docs/REGLES.md et les valeurs par défaut du moteur.
// Usage : node scripts/docs/regles-joueurs.cjs "docs/Greed Island - Règles du jeu.docx" (bibliothèque docx@9 requise).
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, LevelFormat, BorderStyle, ExternalHyperlink, Footer, PageNumber, PageBreak, Bookmark, InternalHyperlink,
} = require('docx');

const OUT = process.argv[2];
const ENCRE = '1F2A44';
const OR = 'B8860B';
const GRIS = 'F3F1EA';

const t = (text, o = {}) => new TextRun({ text, ...o });
const b = (text) => t(text, { bold: true });
const lien = (url, label) => new ExternalHyperlink({ link: url, children: [t(label ?? url, { style: 'Hyperlink' })] });
const enfants = (children) => children.map((c) => (typeof c === 'string' ? t(c) : c));
const p = (...children) => new Paragraph({ spacing: { after: 120 }, children: enfants(children) });
// Sommaire écrit ici (liens vers des signets) : un champ « table des matières » demande Word pour se remplir.
const titres = [];
const titre = (niv) => (text) => {
  const id = `t${titres.length + 1}`;
  titres.push({ text, id, niv });
  return new Paragraph({ heading: niv === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [new Bookmark({ id, children: [t(text)] })] });
};
const h1 = titre(1);
const h2 = titre(2);
const SOMMAIRE = 'sommaire';
const puce = (...children) => new Paragraph({ numbering: { reference: 'puces', level: 0 }, spacing: { after: 60 }, children: enfants(children) });
const etape = (ref, ...children) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 }, children: enfants(children) });
const encadre = (...children) => new Paragraph({
  spacing: { before: 120, after: 160 },
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF6DD' },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: OR, space: 8 } },
  indent: { left: 200, right: 200 },
  children: enfants(children),
});

const LARGEUR = 9638; // A4, marges 2 cm
function tableau(entetes, lignes, largeurs) {
  const bord = { style: BorderStyle.SINGLE, size: 4, color: 'C9C3B0' };
  const bords = { top: bord, bottom: bord, left: bord, right: bord };
  const cellule = (contenu, i, entete) => new TableCell({
    width: { size: largeurs[i], type: WidthType.DXA },
    borders: bords,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: entete ? ENCRE : (i === 0 ? GRIS : 'FFFFFF') },
    children: [new Paragraph({ children: (Array.isArray(contenu) ? contenu : [contenu]).map((c) => (typeof c === 'string' ? t(c, entete ? { bold: true, color: 'FFFFFF' } : i === 0 ? { bold: true } : {}) : c)) })],
  });
  return new Table({
    width: { size: LARGEUR, type: WidthType.DXA },
    columnWidths: largeurs,
    rows: [
      new TableRow({ tableHeader: true, children: entetes.map((e, i) => cellule(e, i, true)) }),
      ...lignes.map((l) => new TableRow({ children: l.map((c, i) => cellule(c, i, false)) })),
    ],
  });
}
const espace = () => new Paragraph({ spacing: { after: 120 }, children: [] });

const JOUEUR = 'https://greed-island-joueur.jarvismboummeu28.workers.dev';

const listes = ['puces', 'entree', 'clear', 'echange', 'classement'];
const numbering = {
  config: listes.map((ref) => ({
    reference: ref,
    levels: [ref === 'puces'
      ? { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }
      : { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }],
  })),
};

const contenu = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER, children: [t('GREED ISLAND', { bold: true, size: 64, color: ENCRE, characterSpacing: 60 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [t('Règles du jeu', { size: 34, color: OR })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [t('Tout ce qu’un Hunter doit savoir pour remplir son Book', { size: 24, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [t('Version du 18 octobre 2026', { size: 20, color: '666666' })] }),
  new Paragraph({ children: [new PageBreak()] }),

  new Paragraph({ spacing: { after: 200 }, children: [t('Sommaire', { bold: true, size: 32, color: ENCRE })] }),
  SOMMAIRE,
  new Paragraph({ children: [new PageBreak()] }),

  // 1
  h1('1. Le jeu en bref'),
  p('Greed Island est une chasse aux cartes grandeur nature, inspirée du jeu de ', t('Hunter × Hunter', { italics: true }), '. Des QR codes, les ', b('balises'), ', sont cachés sur le terrain. Scanne-les avec ton téléphone pour gagner des cartes, des sorts et des jenny (J), la monnaie du jeu.'),
  p('Ton but : ', b('remplir ton Book'), ', c’est-à-dire réunir toutes les cartes du catalogue de la partie, chacune rangée à sa place. Le premier qui y arrive fait un ', b('Clear'), ' et gagne la partie, avec de vrais lots.'),
  p('Tu n’es pas seul : les autres joueurs peuvent te voler des cartes avec des sorts, échanger avec toi, ou te refiler des contrefaçons. Un Game Master (GM) et des arbitres (PNJ) animent la partie.'),
  encadre(b('Les trois règles d’or. '), t('Un téléphone = un joueur. Ta localisation reste allumée. On ne photographie jamais une balise : un QR se scanne sur place, pas depuis une photo.')),

  // 2
  h1('2. Entrer dans la partie'),
  h2('Ce qu’il te faut'),
  puce('Un téléphone avec un navigateur récent (Chrome, Safari…), la caméra et la ', b('localisation activées'), '.'),
  puce('Du réseau mobile. S’il coupe un instant, tes scans sont gardés et envoyés au retour (partie 4).'),
  puce('Une batterie chargée : le jeu utilise le GPS en continu. Une batterie externe est conseillée.'),
  h2('S’inscrire'),
  etape('entree', 'Scanne le QR ', b('« Rejoindre la partie »'), ' affiché par l’organisation. Ou ouvre ', lien(JOUEUR), ' et tape le ', b('code de la partie'), ' (6 caractères, par exemple KX7P2M).'),
  etape('entree', 'Choisis ton ', b('pseudo de Hunter'), ' (2 à 20 caractères, unique dans la partie).'),
  etape('entree', 'Passe l’', b('Examen Hunter'), ' : 3 questions. Chaque bonne réponse rapporte 10 J. Une erreur ne t’élimine pas.'),
  etape('entree', 'Passe le ', b('test de Nen'), ' : 5 questions qui décident de ton type de Nen, ton pouvoir pour toute la partie (partie 9).'),
  etape('entree', 'Tu reçois ton ', b('kit de départ'), ' : 50 J et un sort au hasard.'),
  p('Tu peux installer l’app sur ton écran d’accueil : menu du navigateur → « Ajouter à l’écran d’accueil ».'),
  h2('Ta licence'),
  p('Ta ', b('licence'), ' est un QR code dans l’app, qui change toutes les 30 secondes : impossible de la copier. Montre-la aux arbitres quand ils te la demandent : checkpoint, arène, expertise, Clear.'),

  // 3
  h1('3. Le déroulement d’une partie'),
  tableau(['Moment', 'Ce qui se passe'], [
    ['Inscriptions', 'Tu t’inscris et tu passes l’Examen. Aucun scan possible.'],
    ['En cours', 'La chasse est ouverte. Les retardataires peuvent encore s’inscrire tant que le GM n’a pas fermé les inscriptions.'],
    ['Pause', 'Le GM peut mettre le jeu en pause : plus de scan, de sort, d’échange ni d’achat. Les comptes à rebours (gels, immunités, évènements) s’arrêtent puis reprennent.'],
    ['Phase finale', 'Les 30 dernières minutes, ou plus tôt si le GM le décide. Les inscriptions sont fermées.'],
    ['Terminée', 'À l’heure de fin (2 h de jeu par défaut) ou dès qu’un Clear est confirmé. Plus aucune action ; le classement est figé.'],
  ], [2400, 7238]),

  // 4
  h1('4. Chasser les balises'),
  h2('Scanner'),
  p('Touche ', b('Scanner'), ' dans l’app et vise le QR. Tu peux aussi le scanner avec l’appareil photo du téléphone : l’app s’ouvre directement. Si la balise est active, une carte jaillit : c’est un ', b('tirage'), '.'),
  p('Un tirage peut donner :'),
  puce(b('une carte'), ' de collection (environ 82 % des tirages), du rang D (la plus courante) au rang SS (la plus rare) ;'),
  puce(b('un sort'), ' (environ 13 %) ;'),
  puce(b('des jenny'), ' (environ 5 %).'),
  p('Toutes les balises se ressemblent, mais certaines sont ', b('rares'), ' quand elles se réveillent : elles donnent plus souvent des cartes C à S. Pendant une ', b('Apparition'), ' (évènement du GM), une balise devient ', b('fantôme'), ' et donne une carte S ou SS.'),
  h2('Ce que dit une balise'),
  tableau(['Message', 'Ce que ça veut dire'], [
    ['Une carte jaillit', 'La balise est active : tu as gagné quelque chose.'],
    ['« Cette balise dort »', 'Elle est endormie. Elle se réveillera plus tard.'],
    ['« Plus rien ici, cherche ailleurs »', 'Son stock est vide. Elle se rendormira, puis se réveillera plus tard.'],
    ['Refus sans explication', 'Le GM l’a coupée.'],
  ], [3600, 6038]),
  p('Les balises ', b('tournent'), ' : toutes les 20 minutes, une partie des balises actives s’endort et d’autres se réveillent, en priorité dans les zones peu visitées. Bouge !'),
  h2('Les limites du scan'),
  puce(b('30 secondes'), ' au moins entre deux scans.'),
  puce(b('La boucle'), ' : après un tirage sur une balise, réussis des tirages sur ', b('3 autres balises'), ' différentes (2 s’il y a peu de balises actives) avant d’y retirer. L’app te dit combien il en reste.'),
  puce(b('Le rendement baisse'), ' : ton 2e tirage sur une même balise ne dépasse pas le rang B ; le 3e et les suivants, pas le rang D.'),
  puce(b('Book plein'), ' : plus de place, le gain est refusé et la balise garde son stock.'),
  puce(b('Sans GPS'), ' (pas de position depuis plus de 2 minutes) : ni scan, ni achat, ni sort.'),
  p('Un refus ne coûte rien et te dit toujours pourquoi.'),
  encadre(b('Réseau coupé ? '), t('Ton scan est mis en attente avec son heure, puis envoyé au retour du réseau, s’il a moins de 10 minutes. Il est alors jugé selon l’état du jeu à ce moment-là.')),
  h2('La carte de l’île'),
  p('L’accueil de l’app montre l’île : les villes, les zones de chasse et le ', b('nombre de balises actives par zone'), ', jamais lesquelles ni où. Tu y vois ta propre position ; personne d’autre ne la voit.'),

  // 5
  h1('5. Ton Book'),
  p('Le Book est ton classeur de cartes. Il a trois parties :'),
  tableau(['Partie', 'À quoi elle sert'], [
    ['Emplacements fixes', 'Une place par carte du catalogue, dans l’ordre des numéros de l’anime (000 à 099). Une carte s’y range toute seule quand tu l’obtiens. Seules les cartes rangées ici comptent pour le Clear et le classement.'],
    ['Emplacements libres', '15 places pour tes doublons et tes sorts. Plein = plus de gain possible : revends ou échange.'],
    ['Page Objets', '8 places pour les objets (partie 7). Les cartes de Maître du jeu (partie 11) s’y ajoutent sans prendre de place.'],
  ], [2600, 7038]),
  h2('Les rangs et les limites'),
  p('Chaque carte a un ', b('rang'), ' : D, C, B, A, S et SS. Il n’y a qu’', b('une seule carte SS'), ' au catalogue, « Le bonheur du détenteur » (n° 000), la plus convoitée.'),
  p('Chaque carte a une ', b('limite d’exemplaires'), ' dans la partie, écrite dans son coin : « A-3 » veut dire 3 exemplaires au plus. À la limite, elle ne se tire plus. Tu vois la limite, jamais combien d’exemplaires circulent.'),
  h2('Cacher une carte'),
  p('Tu peux ', b('déplacer'), ' à tout moment une carte de son emplacement fixe vers un emplacement libre, pour la ', b('cacher'), ', puis la remettre. C’est gratuit. Une carte cachée échappe au sort Vol mais pas à Pickpocket, et ', b('elle ne compte plus'), ' pour le Clear tant qu’elle n’est pas remise à sa place.'),
  p('Chaque carte a une ', b('fiche de provenance'), ' : d’où elle vient, qui te l’a donnée. Une carte volée laisse sa place vide, avec la mention « Volée par X à 14 h 05 ».'),

  // 6
  h1('6. Les villes et les checkpoints'),
  p('Trois villes sont tenues par l’organisation. Pour y faire quelque chose, scanne le ', b('QR du lieu'), ' sur place : il prouve que tu y es.'),
  h2('Masadora, la boutique'),
  puce(b('Paquet de 3 sorts au hasard'), ' : 50 J. Les paquets arrivent par vagues de 20 minutes, en stock limité ; 2 paquets au plus par joueur et par vague.'),
  puce(b('Revente'), ' des cartes : D 5 J · C 10 J · B 20 J · A 40 J · S 80 J. La SS ne se revend pas. Une carte revendue sort du jeu et libère une place dans sa limite.'),
  puce('Revente des objets : Pépite d’or 30 J, les autres 10 J.'),
  puce('Masadora démasque toute contrefaçon qu’on lui vend et n’en donne que 1 J.'),
  puce('Le GM peut ouvrir une ', b('roulette'), ' : chaque tour coûte des jenny.'),
  h2('Antokiba, les enchères'),
  puce('Un arbitre met une carte aux enchères pendant ', b('3 minutes'), '. Même la SS peut y passer.'),
  puce('Scanne le QR d’Antokiba sur place, puis surenchéris dans l’app. Ce scan reste valable 15 minutes.'),
  puce(b('Seul le gagnant paie'), ' : si tu es dépassé, tu ne perds rien.'),
  puce(b('Expertise'), ' : l’arbitre d’Antokiba vérifie tes cartes, 10 J la page ou 25 J tout le Book. Les contrefaçons trouvées sont marquées (partie 10).'),
  h2('Soufrabi, l’arène'),
  puce('Montre ta licence à l’arbitre et paie la ', b('mise de 30 J'), '.'),
  puce('Il arbitre un défi physique ou d’adresse. ', b('Victoire'), ' : une carte de rang A (50 %), S (40 %) ou SS (10 %). ', b('Défaite'), ' : la mise est perdue.'),
  puce('Une tentative toutes les ', b('15 minutes'), '. Une victoire en S ou SS est annoncée sur l’écran géant.'),
  h2('Les checkpoints'),
  p('Des arbitres tiennent des ', b('checkpoints'), ' sur le terrain, avec un défi. Réussis-le et montre ta licence : tu reçois une carte de leur stock (souvent B, A ou S) et parfois des jenny.'),

  // 7
  h1('7. Les objets'),
  p('Quand tu tombes sur une carte épuisée, la balise te donne 10 J à la place, et une fois sur trois un ', b('objet'), ' en plus. Les objets s’échangent mais ne se volent pas.'),
  tableau(['Objet', 'Effet'], [
    ['Pépite d’or', 'Se revend 30 J à Masadora.'],
    ['Loterie', 'À gratter : 0, 10, 30 ou 100 J. Ne se revend pas.'],
    ['Boussole du chercheur', 'Indique la direction (jamais la distance) de la balise active la plus proche parmi celles que tu as déjà scannées.'],
    ['Second souffle', 'Au scan, passe outre la boucle. Il n’est consommé que si la boucle t’aurait refusé ; le rendement qui baisse s’applique quand même.'],
    ['Rideau noir', 'Bloque la prochaine Trace, Voyance ou Clairvoyance lancée sur toi.'],
    ['Solidité', 'Une carte de ton choix ne peut être ni volée ni prise par Échange pendant 20 minutes.'],
  ], [2800, 6838]),

  // 8
  h1('8. Les sorts'),
  p('Les sorts viennent des balises, des paquets de Masadora et du kit. Ils se rangent dans tes emplacements libres et ne servent qu’', b('une fois'), '.'),
  h2('Sorts offensifs'),
  tableau(['Sort', 'Effet', 'Cible'], [
    ['Vol', 'Prend 1 carte au hasard dans ses emplacements fixes.', 'Un joueur à portée'],
    ['Pickpocket', 'Prend 1 carte au hasard dans ses emplacements libres (pas ses sorts).', 'Un joueur à portée'],
    ['Échange', 'Tu lui donnes 1 carte de ton choix et tu lui en prends 1 au hasard.', 'Un joueur à portée'],
    ['Gel', 'Il ne peut plus scanner pendant 3 minutes.', 'Un joueur à portée'],
    ['Accompagnement', 'Tu vois sa position exacte en direct pendant 3 minutes, et il est gelé 3 minutes (ni scan, ni sort, ni échange).', 'Un joueur déjà croisé, même loin'],
  ], [2000, 5038, 2600]),
  h2('Sorts d’information et de défense'),
  tableau(['Sort', 'Effet'], [
    ['Trace', 'Montre la zone où un joueur était en dernier.'],
    ['Guide', 'Montre la zone d’une balise rare active.'],
    ['Voyance', 'Montre les emplacements libres d’un joueur déjà croisé. Anonyme : il sait que quelqu’un a regardé, pas qui.'],
    ['Clairvoyance', 'Montre les emplacements fixes d’un joueur déjà croisé. Anonyme aussi.'],
    ['Pénétration', 'Rend leur vraie apparence aux cartes modifiées d’une page de ton Book : démasque les contrefaçons.'],
    ['Mimétisme', 'Copie une carte de ton Book : vrai exemplaire si sa limite n’est pas atteinte, sinon contrefaçon.'],
    ['Mur défensif', 'Annule le prochain sort offensif lancé sur toi. Il agit tout seul.'],
    ['Retour', 'Pendant 10 minutes, utilise à distance une ville déjà visitée : acheter ou revendre à Masadora, enchérir à Antokiba.'],
  ], [2400, 7238]),
  h2('Les règles des sorts offensifs'),
  puce(b('Portée'), ' : la cible doit être à ', b('30 mètres'), ' environ. L’app ne te propose que les joueurs à portée.'),
  puce(b('Immunité'), ' : un joueur touché ne peut plus être visé par un sort offensif pendant ', b('5 minutes'), '.'),
  puce(b('2 minutes'), ' au moins entre deux sorts offensifs d’un même lanceur.'),
  puce(b('Protections'), ' : le Mur défensif part en premier, puis le pouvoir de Renforcement. Une protection utilisée est perdue.'),
  puce('La cible est prévenue tout de suite (qui, quel sort, résultat), sauf pour Voyance et Clairvoyance. Tous les sorts s’affichent sur l’écran géant.'),
  puce(b('« Déjà croisé »'), ' : vous avez été à portée l’un de l’autre au moins une fois, ou l’un a visé l’autre avec un sort.'),
  encadre(b('Couper son GPS ne protège pas. '), t('Un joueur sans nouvelle position reste visable à sa dernière position connue pendant 10 minutes. Et sans GPS, tu ne peux plus rien faire toi-même.')),

  // 9
  h1('9. Ton Nen'),
  p('Le test de Nen te donne l’un des six types. Ton pouvoir dure toute la partie et ', b('se recharge'), ' après usage.'),
  tableau(['Type', 'Pouvoir'], [
    ['Renforcement', 'Annule le premier sort offensif reçu. Se recharge en 30 minutes.'],
    ['Émission', 'Lance un sort offensif hors de portée. Se recharge en 40 minutes.'],
    ['Transformation', 'Texture Surprise : déguise un doublon en une autre carte de même rang (une contrefaçon), toutes les 20 minutes. Un doublon S peut même imiter la SS, pour bluffer.'],
    ['Matérialisation', 'Un tirage bonus (rang C au plus) à chaque checkpoint réussi, et un autre toutes les 40 minutes.'],
    ['Manipulation', 'Un Échange gratuit, sans carte de sort. Se recharge en 40 minutes.'],
    ['Spécialisation', 'Type rare (5 % des joueurs). Wing te pose une question secrète qui choisit ton pouvoir, connu de toi seul. Se recharge en 40 minutes.'],
  ], [2400, 7238]),
  h2('Les pouvoirs de Spécialisation'),
  tableau(['Pouvoir', 'Effet'], [
    ['Alchimie', 'Change un doublon en une carte de ton choix, du même rang ou du rang au-dessus, jamais la SS.'],
    ['L’épée du vol', 'Un Vol sans carte de sort, sur la carte de ton choix si la cible l’a, jamais la SS.'],
    ['Zetsu', 'Invisible 10 minutes : personne ne peut te viser, te voir dans les listes ni t’inviter à un échange. Lancer un sort offensif ou proposer un échange le rompt.'],
    ['Fortune', 'Ton prochain scan réussi donne un gain de plus.'],
  ], [2400, 7238]),

  // 10
  h1('10. Les contrefaçons'),
  p('Une ', b('contrefaçon'), ' a l’air d’une vraie carte mais n’en est pas une. Elle naît d’un ', b('Mimétisme'), ' sur une carte à sa limite, ou de ', b('Texture Surprise'), ' (Transformation).'),
  puce('Elle prend une place, même un emplacement fixe, et s’échange, se vole et se revend comme une vraie.'),
  puce('Elle ', b('ne compte pas'), ' pour le Clear ni pour le classement final.'),
  puce('Une carte reçue a toujours l’air vraie : on ne peut rien vérifier avant d’accepter un échange.'),
  puce('Celui qui l’a créée la voit marquée ; la marque disparaît quand elle change de main.'),
  h2('Démasquer'),
  puce('Le sort ', b('Pénétration'), ' sur une page de ton Book, ou l’', b('expertise'), ' à Antokiba (10 J la page, 25 J le Book).'),
  puce('Un doublon déguisé redevient sa vraie carte. Une copie de Mimétisme devient « Contrefaçon de… », grisée, et libère l’emplacement fixe. Tu peux la revendre 1 J ou tenter de la refiler.'),
  encadre(b('Astuce. '), t('Recoupe : si tu repères plus d’exemplaires d’une carte que sa limite (« A-3 » et 4 exemplaires vus avec Voyance ou Clairvoyance), il y a une fausse quelque part.')),

  // 11
  h1('11. Les cartes de Maître du jeu'),
  p('Deux cartes à cadre noir, ', b('uniques'), ' dans la partie. Elles ne comptent ni pour le Clear ni pour le classement, mais elles peuvent renverser une partie.'),
  tableau(['Carte', 'Effet'], [
    ['Jarvis tout-puissant', 'Deux effets à la fois, que rien n’arrête. Décret : la carte du catalogue de ton choix (sauf la SS) apparaît à sa place dans ton Book ; si sa limite est atteinte, elle est reprise à un autre joueur au hasard. Jugement : tous les joueurs à portée sont gelés 3 minutes, et tu es intouchable 10 minutes. Tous les joueurs sont prévenus : « Jarvis a parlé ».'],
    ['Le Sceau d’Ange', 'Le Book d’un joueur à portée est scellé 5 minutes : ni scan, ni sort, ni échange, ni déplacement de carte, ni objet. Ni le Mur défensif ni Zetsu ne l’arrêtent. La cible est ensuite immunisée 5 minutes.'],
  ], [2400, 7238]),
  puce(b('Comment les obtenir'), ' : par chance au scan (rare), en récompense d’un raid ou d’un évènement, aux enchères d’Antokiba, ou en cadeau du GM.'),
  puce('Elles s’échangent, passent aux enchères et se volent avec le sort Vol (pas avec Pickpocket ni L’épée du vol).'),
  puce(b('Usage unique'), ' : une fois jouée, la carte retourne au Maître du jeu et peut réapparaître.'),

  // 12
  h1('12. Échanger'),
  etape('echange', 'Dans l’app, choisis un joueur ', b('à portée'), ' et propose-lui un échange.'),
  etape('echange', 'Il reçoit l’invitation et a 60 secondes pour accepter.'),
  etape('echange', 'Chacun compose sa part (cartes, objets, jenny) en voyant celle de l’autre.'),
  etape('echange', 'L’échange n’a lieu que si ', b('les deux valident'), '. Toute modification annule les deux validations.'),
  puce('Chacun doit donner au moins une carte ou des jenny : le don pur est refusé.'),
  puce('Une même paire de joueurs : un échange toutes les 10 minutes.'),
  puce('Sans action pendant 3 minutes, l’échange expire. Chacun peut annuler à tout moment.'),

  // 13
  h1('13. Les évènements du GM'),
  p('Le GM lance des évènements pendant la partie. L’app et l’écran géant les annoncent.'),
  tableau(['Évènement', 'Effet'], [
    ['Apparition', 'Une balise fantôme dans une zone : 1 ou 2 tirages S ou SS. 10 minutes.'],
    ['Double gain', 'Chaque tirage d’une zone donne 2 gains. 10 minutes.'],
    ['Zone maudite', 'La zone est fermée : scans refusés. 10 minutes.'],
    ['Raid', 'Un boss collectif à battre en répondant juste à des questions. Victoire : un paquet de sorts pour chaque participant, et parfois une carte de Maître du jeu pour le meilleur chasseur. 10 minutes.'],
    ['Krach de Masadora', 'La boutique à -50 %. 15 minutes.'],
    ['Carte maudite', 'Une carte piégée circule, d’abord chez un joueur au hasard. Celui qui l’a à la fin perd 2 cartes au hasard (jamais la SS). 10 minutes : refile-la !'],
    ['Mission secrète', 'Un objectif confié à un seul joueur, validé par un arbitre.'],
  ], [2400, 7238]),

  // 14
  h1('14. Gagner'),
  h2('Le Clear'),
  etape('clear', 'Quand toutes les cartes du catalogue sont rangées dans tes emplacements fixes, ton Book est complet : il se ', b('gèle'), ' et plus aucun sort ne l’atteint.'),
  etape('clear', 'Va voir le GM. S’il reste une contrefaçon, le Clear est refusé : on t’indique la page, pas la carte.'),
  etape('clear', 'Le GM scanne ta licence : ', b('Clear confirmé'), ', la partie se termine et tu gagnes.'),
  etape('clear', 'Tu choisis ', b('3 cartes'), ' de ton Book : ce sont tes ', b('lots réels'), '.'),
  h2('Le classement'),
  p('Sans Clear, la partie se termine à l’heure de fin. Le classement départage les joueurs dans cet ordre :'),
  etape('classement', 'le nombre de cartes différentes du catalogue rangées dans tes emplacements fixes ;'),
  etape('classement', 'la somme de leurs rangs (SS 6, S 5, A 4, B 3, C 2, D 1) ;'),
  etape('classement', 'tes jenny ;'),
  etape('classement', 'l’heure de ta dernière carte du catalogue : le plus tôt gagne.'),
  p('Les 3 premiers montent sur le ', b('podium'), ' et reçoivent les lots de l’organisation, en plus du Clear. Pendant la partie, l’écran géant compte aussi les contrefaçons ; le classement final ne compte que les vraies cartes.'),

  // 15
  h1('15. Fair-play et sanctions'),
  p('Le jeu repère les comportements suspects et prévient l’équipe. Il ne sanctionne jamais seul : ce sont les arbitres et le GM qui décident.'),
  tableau(['Comportement', 'Sanction'], [
    ['Scanner la photo d’une balise', 'Gains annulés et gel de 5 minutes.'],
    ['Sortir de la zone de jeu', 'Avertissement.'],
    ['Faux GPS', 'Disqualification.'],
    ['Déplacer ou abîmer une balise', 'Disqualification.'],
    ['Plusieurs comptes', 'Disqualification de tous les comptes.'],
  ], [4400, 5238]),
  p('Un joueur disqualifié perd son Book. Chaque sanction t’est notifiée avec son motif.'),
  h2('Rester actif'),
  puce('Sans aucune action de jeu pendant ', b('15 minutes'), ', tu passes « inactif ». Tu redeviens actif à ta prochaine action.'),
  puce('Inactif ', b('20 minutes'), ' : ta carte SS et tes cartes de Maître du jeu retournent en jeu.'),
  puce('Tu peux ', b('abandonner'), ' depuis l’app : tes cartes SS et de Maître du jeu retournent en jeu, et tu peux encore suivre la partie.'),

  // 16
  h1('16. Conseils de Hunter'),
  puce(b('Varie les balises'), ' : la boucle et le rendement qui baisse punissent ceux qui restent au même endroit.'),
  puce(b('Garde de la place'), ' : un Book plein refuse les gains. Revends tes doublons à Masadora ou échange-les.'),
  puce(b('Cache tes meilleures cartes'), ' quand des joueurs rôdent, mais remets-les en place avant ton Clear.'),
  puce(b('Garde un Mur défensif'), ' : c’est la meilleure assurance contre un Vol.'),
  puce(b('Méfie-toi des échanges trop beaux'), ' : la carte reçue peut être une contrefaçon. Fais-la expertiser.'),
  puce(b('Surveille l’écran géant'), ' et les annonces : une Apparition ou un Double gain change toute la chasse.'),
  puce(b('Économise ta batterie'), ' : baisse la luminosité et ferme les autres apps.'),
  espace(),
  p(t('Bonne chasse, Hunter.', { italics: true, color: ENCRE, bold: true })),
];

contenu.splice(contenu.indexOf(SOMMAIRE), 1, ...titres.map((x) => new Paragraph({
  spacing: { after: x.niv === 1 ? 80 : 40, before: x.niv === 1 ? 120 : 0 },
  indent: x.niv === 2 ? { left: 400 } : undefined,
  children: [new InternalHyperlink({ anchor: x.id, children: [t(x.text, x.niv === 1 ? { bold: true, color: ENCRE } : { color: '444444' })] })],
})));

const doc = new Document({
  creator: 'loJIC Solutions',
  title: 'Greed Island : règles du jeu',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: ENCRE }, paragraph: { keepNext: true, keepLines: true, spacing: { before: 360, after: 160 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: OR, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: OR }, paragraph: { keepNext: true, keepLines: true, spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering,
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Greed Island · Règles du jeu · page ', { size: 18, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' })] })] }) },
    children: contenu,
  }],
});

Packer.toBuffer(doc).then((buf) => fs.writeFileSync(OUT, buf));
