// Guide de la console GM / PNJ de Greed Island (Word). Usage : node scripts/docs/guide-console.cjs "docs/Greed Island - Guide de la console.docx" (bibliothèque docx@9 requise), puis mettre à jour le sommaire dans Word.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, LevelFormat, BorderStyle, ExternalHyperlink, Footer, PageNumber, PageBreak, TableOfContents,
} = require('docx');

const OUT = process.argv[2];
const ENCRE = '1F2A44';
const OR = 'B8860B';
const GRIS = 'F3F1EA';

const t = (text, o = {}) => new TextRun({ text, ...o });
const b = (text) => t(text, { bold: true });
const lien = (url, label) => new ExternalHyperlink({ link: url, children: [t(label ?? url, { style: 'Hyperlink' })] });
const p = (...children) => new Paragraph({ spacing: { after: 120 }, children: children.map((c) => (typeof c === 'string' ? t(c) : c)) });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(text)] });
const puce = (...children) => new Paragraph({ numbering: { reference: 'puces', level: 0 }, spacing: { after: 60 }, children: children.map((c) => (typeof c === 'string' ? t(c) : c)) });
const etape = (ref, ...children) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 }, children: children.map((c) => (typeof c === 'string' ? t(c) : c)) });
const encadre = (...children) => new Paragraph({
  spacing: { before: 120, after: 160 },
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF6DD' },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: OR, space: 8 } },
  indent: { left: 200, right: 200 },
  children: children.map((c) => (typeof c === 'string' ? t(c) : c)),
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

const CONSOLE = 'https://greed-island-console.jarvismboummeu28.workers.dev';
const JOUEUR = 'https://greed-island-joueur.jarvismboummeu28.workers.dev';
const ECRAN = 'https://greed-island-ecran.jarvismboummeu28.workers.dev';
const API = 'https://greed-island-api.onrender.com';

const listes = ['puces', 'avant', 'jourj', 'prep', 'clear', 'pnj'];
const numbering = {
  config: listes.map((ref) => ({
    reference: ref,
    levels: [ref === 'puces'
      ? { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }
      : { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }],
  })),
};

const contenu = [
  // Page de titre
  new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER, children: [t('GREED ISLAND', { bold: true, size: 64, color: ENCRE, characterSpacing: 60 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [t('Guide de la console Game Master et PNJ', { size: 34, color: OR })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [t('Préparer, lancer, arbitrer et terminer une partie', { size: 24, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [t('loJIC Solutions · version du 18 octobre 2026', { size: 20, color: '666666' })] }),
  new Paragraph({ children: [new PageBreak()] }),

  new Paragraph({ spacing: { after: 200 }, children: [t('Sommaire', { bold: true, size: 32, color: ENCRE })] }),
  new TableOfContents('Sommaire', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),

  // 1. Adresses
  h1('1. Toutes les adresses'),
  p('Le jeu est en ligne gratuitement depuis le 18 octobre 2026. Garde ce tableau sous la main : ce sont les seules adresses à connaître.'),
  tableau(['À quoi ça sert', 'Adresse', 'Pour qui'], [
    ['Console (GM et PNJ)', lien(CONSOLE), 'Toi et ton équipe'],
    ['App joueur', lien(JOUEUR), 'Les joueurs (sur leur téléphone)'],
    ['Écran géant', [lien(ECRAN), t('/?partie=<identifiant de la partie>')], 'Le grand écran ou le vidéoprojecteur'],
    ['Serveur du jeu (vérifier qu’il est réveillé)', [lien(`${API}/sante`)], 'Toi : doit afficher {"ok":true}'],
  ], [2500, 4938, 2200]),
  espace(),
  h2('Les coulisses (hébergement)'),
  p('Tu n’en as besoin qu’en cas de souci. Tout est en offre gratuite.'),
  tableau(['Service', 'Adresse', 'Ce qu’on y fait'], [
    ['Supabase (base de données)', lien('https://supabase.com/dashboard/project/fbgwtnzflyrpfsniugqi'), 'Relancer la base si elle s’est mise en pause (« Restore »).'],
    ['Render (serveur du jeu)', lien('https://dashboard.render.com/web/srv-dba4ivu1egvs739bc20g'), 'Voir s’il est « Live », lire les journaux, changer le code organisateur (Environment → GQ_ADMIN_CODE).'],
    ['Cloudflare (les 3 apps)', lien('https://dash.cloudflare.com'), 'Workers : greed-island-joueur, greed-island-console, greed-island-ecran.'],
    ['Code source (GitHub)', lien('https://github.com/JarvisBG/greed_quest'), 'Branche refonte-joueur : chaque mise à jour relance le serveur toute seule.'],
  ], [2500, 4138, 3000]),
  encadre(b('Les codes secrets ne sont jamais écrits dans ce guide. '), t('Le code organisateur est rangé dans Render (Environment → GQ_ADMIN_CODE). Les codes du GM et des PNJ sont choisis à la création et ne sont plus jamais affichés : note-les dans un endroit sûr.')),

  // 2. Rôles
  h1('2. Qui fait quoi'),
  p('La console sert à deux rôles. Chacun se connecte avec l’identifiant de la partie et son propre code.'),
  tableau(['Rôle', 'Ce qu’il voit dans le menu', 'Son travail'], [
    ['Game Master (GM)', 'Tout : Dashboard, Joueurs, Scanner une licence, Carte, Évènements, Clear, Préparation, Planche QR, Paramètres, Checkpoints, Arène, Enchères, Missions, Alertes, Journal', 'Prépare la partie, la lance et la termine, lance les évènements, corrige et sanctionne, confirme le Clear.'],
    ['PNJ (arbitre)', 'Dashboard, Joueurs, Scanner une licence, Checkpoints, Arène, Enchères, Missions, Alertes, Journal', 'Arbitre sur le terrain : checkpoints, arène, enchères, missions, avertissements.'],
  ], [1900, 4238, 3500]),
  espace(),
  p('En haut de chaque page : le nom de la partie, l’état et le chrono (par exemple « En cours · 1 h 12 min · J 4 »), et la pastille ', b('EN DIRECT'), ' (rouge « HORS LIGNE » si la connexion est perdue). Sur téléphone, le bouton ', b('Menu'), ' ouvre la liste des pages ; le nombre entre parenthèses compte les alertes non lues.'),

  // 3. Créer la partie
  h1('3. Créer la partie (une seule fois)'),
  etape('avant', 'Ouvre la console : ', lien(CONSOLE), '.'),
  etape('avant', 'Clique sur le lien du bas ', b('« Organisateur : créer une nouvelle partie »'), '.'),
  etape('avant', b('Code organisateur'), ' : celui rangé dans Render (GQ_ADMIN_CODE).'),
  etape('avant', b('Nom de la partie'), ' (ex. « Les plaines de Yorknew »), puis un préréglage : ', b('Petit groupe'), ' (moins de 15 joueurs, petit lieu), ', b('Standard'), ' ou ', b('Grande foule'), ' (plus de 50 joueurs). Tout reste modifiable ensuite dans Paramètres.'),
  etape('avant', b('Joueurs attendus'), ' : sert à choisir combien de cartes il faudra réunir dans le Book (tirées au hasard).'),
  etape('avant', 'Case ', b('« Remplir avec une partie de démonstration »'), ' : coche-la seulement pour un essai (catalogue, zones et balises d’exemple, posés à Douala).'),
  etape('avant', b('Ton nom'), ' de Game Master et ', b('ton code de connexion (6 caractères ou plus)'), ', puis ', b('Créer la partie'), '.'),
  encadre(b('Note l’identifiant de la partie. '), t('Après la création, l’adresse de la console se termine par « ?partie=… ». Copie cette adresse entière : envoyée à un PNJ, elle remplit l’identifiant pour lui, il n’a plus qu’à taper son code. Le même identifiant sert pour l’écran géant.')),

  // 4. Préparer
  h1('4. Préparer le terrain (page Préparation)'),
  p('La page Préparation a cinq onglets, à faire dans l’ordre. Les conseils affichés en haut viennent du moteur du jeu, selon le nombre de joueurs attendus : ce sont des recommandations, rien n’est bloqué.'),
  h2('Zones'),
  puce('Une zone = un territoire de l’île : ', b('Masadora'), ' (boutique), ', b('Antokiba'), ' (enchères), ', b('Soufrabi'), ' (arène), ou ', b('zone sauvage'), ' (chasse aux balises).'),
  puce('Trace ses coins en touchant la vraie carte (satellite ou plan), ou sur place avec ', b('« Ajouter ma position »'), ', ou colle des coordonnées « latitude, longitude ». ', b('« Retirer le dernier coin »'), ' corrige une erreur, ', b('« Centrer sur moi »'), ' recadre la carte.'),
  puce('Sans réseau, la vraie carte ne charge pas : utilise « Ajouter ma position » ou colle les coordonnées.'),
  h2('Balises'),
  puce('Ajoute chaque balise avec sa zone et un ', b('repère'), ' (ex. « B-07 chêne ») ; sa position est facultative (« Relever ma position »).'),
  puce('États : ', b('Activer'), ' (elle s’allume avec un type et un stock tirés au hasard), ', b('Endormir'), ' (elle s’éteint, la rotation pourra la rallumer), ', b('Couper'), ' (retirée du jeu : abîmée, volée… ; un motif est demandé). ', b('Rotation'), ' force un nouveau tirage des balises allumées.'),
  h2('Catalogue'),
  puce('La plateforme propose un tirage de cartes à réunir pour le Clear (« Book à compléter »). Le nombre est réglable ; ', b('« Proposer un autre tirage »'), ' en refait un, ', b('« Retoucher à la main »'), ' permet de choisir parmi les 100 cartes.'),
  puce('Pour chaque carte, tu peux saisir un ', b('lot réel'), ' (ex. « Bon d’achat de 20 € »).'),
  puce('Une fois la partie démarrée, le catalogue ne change plus (seuls les noms et les lots).'),
  h2('Checkpoints'),
  puce('Un checkpoint = un défi tenu par un PNJ (ex. « Réussir 3 paniers de suite »), dans une zone, avec un arbitre (un membre précis ou n’importe qui de l’équipe) et un stock de cartes à gagner, rempli selon le conseil.'),
  h2('Équipe'),
  puce(b('Ajouter un membre'), ' : nom, rôle (PNJ ou Game Master), code de connexion de 6 caractères ou plus. ', b('Donne le code en main propre : il ne sera plus affiché.')),

  h1('5. Régler et imprimer'),
  h2('Paramètres'),
  puce('Les réglages sont rangés par thème : Balises et tirages, Sorts et terrain, Lieux et évènements, Pouvoirs de Nen, Durée de la partie…'),
  puce('Chaque réglage est en ', b('Auto'), ' (calculé par le jeu), en ', b('Valeur fixe'), ' ou en ', b('Multiplicateur'), ' de la valeur auto ; un aperçu montre la valeur appliquée.'),
  puce('À régler selon le lieu : ', b('Portée des sorts'), ' (distance maximale entre deux joueurs) et ', b('Marge GPS acceptée'), '.'),
  puce('Le nombre de cartes à réunir se fixe avant le démarrage. Un ', b('préréglage'), ' s’applique après confirmation ; tu peux aussi enregistrer tes réglages comme nouveau préréglage.'),
  h2('Planche QR'),
  puce('Dans ', b('« Adresse de l’app joueur »'), ', mets : ', lien(JOUEUR), '. Les QR deviennent alors des liens : scannés avec l’appareil photo du téléphone, ils ouvrent directement le jeu.'),
  puce('La planche contient les QR des balises, des lieux et le QR ', b('« Rejoindre la partie »'), ' (inscription des joueurs). Impression 3 par ligne.'),
  puce('Sous chaque QR, un repère (ex. « B07 · Forêt ») aide à poser la balise au bon endroit : découpe-le ou plie-le au dos pour que les joueurs ne le voient pas.'),
  encadre(b('Attention : '), t('l’adresse de l’app joueur est imprimée dans les QR. Si on change d’adresse un jour (vrai nom de domaine), il faudra réimprimer.')),

  // 6. Jour J
  h1('6. Le jour J'),
  etape('jourj', b('30 minutes avant'), ' : ouvre ', lien(`${API}/sante`), '. Le serveur gratuit s’endort après 15 minutes sans visite ; la première ouverture peut prendre environ 1 minute. Quand la page affiche {"ok":true}, il est réveillé.'),
  etape('jourj', 'Connecte-toi à la console et laisse-la ouverte : tant qu’elle (ou l’écran géant) est ouverte, le serveur reste éveillé.'),
  etape('jourj', 'Allume l’écran géant : ', t(`${ECRAN}/?partie=<identifiant>`, { bold: true }), '. Clique sur ', b('« Lancer avec le son »'), ' (voix off et bruitages ; les navigateurs coupent le son tant que personne n’a touché la page).'),
  etape('jourj', b('Dashboard → Phase du jeu'), ' : ', b('Ouvrir les inscriptions'), '. Les joueurs scannent le QR « Rejoindre la partie » ou ouvrent ', lien(JOUEUR), '.'),
  etape('jourj', b('Démarrer la partie'), ' : le chrono part. Chaque bouton demande une confirmation et s’applique tout de suite à tous les téléphones et à l’écran géant.'),
  etape('jourj', 'Ensuite, selon le besoin : ', b('Mettre en pause'), ' / ', b('Reprendre la partie'), ' (le chrono s’arrête en pause), ', b('Lancer la phase finale'), ', puis ', b('Terminer la partie'), '.'),
  p('Le Dashboard montre aussi 4 compteurs (joueurs inscrits, joueurs actifs, Clear en attente, alertes), l’activité récente et les dernières alertes.'),

  // 7. Pendant
  h1('7. Pendant la partie : page par page'),
  h2('Joueurs et Scanner une licence'),
  puce(b('Joueurs'), ' : recherche par pseudo, filtre par statut, tableau (Nen, statut, jenny, avancement du Clear). Un clic ouvre le ', b('profil du joueur'), '.'),
  puce(b('Scanner une licence'), ' : chaque joueur a une licence QR sur son téléphone, qui change toutes les 30 secondes. Scanne-la avec la caméra ; si la caméra est refusée, tape le code affiché sous le QR (il commence par GQL1).'),
  puce('Actions sur un joueur (motif obligatoire, le joueur voit le motif sur son téléphone, tout est écrit dans le Journal) :'),
  tableau(['Action', 'Effet', 'Qui'], [
    ['Avertir', 'Simple avertissement.', 'GM et PNJ'],
    ['Geler 5 min', 'Le joueur ne peut plus jouer pendant 5 minutes.', 'GM et PNJ'],
    ['Annuler les gains d’une balise (photo)', 'Les cartes gagnées sur cette balise lui sont retirées, puis il est gelé 5 min. Pour qui a photographié une balise au lieu de la trouver.', 'GM et PNJ'],
    ['Expertise d’Antokiba', 'Payée par le joueur (une page, ou tout le Book pour 25 J) ; il voit le résultat dans son Book.', 'GM et PNJ'],
    ['Corriger les jenny / le Book', 'Ajouter ou retirer de l’argent ou une carte.', 'GM'],
    ['Donner une carte de Maître du jeu', 'Jarvis tout-puissant ou Le Sceau d’Ange, seulement si personne ne l’a.', 'GM'],
    ['Disqualifier', 'Le joueur perd tout son Book et ne peut plus jouer. Impossible à annuler.', 'GM'],
  ], [2700, 5138, 1800]),
  espace(),
  p('Motifs proposés : sortie de zone, photo de balise, comportement antisportif, balise déplacée ou abîmée, faux GPS (ou un motif libre).'),
  h2('Carte (GM)'),
  puce('Vue ', b('Satellite'), ', ', b('Plan'), ' ou ', b('Dessin'), ' (sans réseau) : zones, balises selon leur état, et la position exacte des joueurs avec un halo de précision. Ces positions ne sont visibles que par le GM, jamais par les joueurs ni sur l’écran géant.'),
  h2('Évènements (GM)'),
  tableau(['Évènement', 'Effet'], [
    ['Double gain', 'Chaque tirage dans la zone choisie donne 2 gains.'],
    ['Zone maudite', 'La zone est fermée : les scans y sont refusés.'],
    ['Apparition', 'Une balise fantôme apparaît dans la zone (1 à 2 tirages S ou SS).'],
    ['Krach de Masadora', 'La boutique de Masadora est à -50 %.'],
    ['Carte maudite', 'Une carte piégée part chez un joueur au hasard et circule ; celui qui l’a à la fin perd 2 cartes au hasard (hors SS).'],
    ['Mission secrète', 'Un objectif pour un seul joueur (ex. « Photo avec un PNJ déguisé »), validé par un PNJ quand il montre la preuve.'],
    ['Raid de la Brigade', 'Boss collectif : chaque bonne réponse lui retire des PV ; s’il tombe, les participants reçoivent un paquet de sorts. Tu peux y mettre une carte de Maître du jeu en lot (pour le meilleur chasseur).'],
  ], [2500, 7138]),
  espace(),
  p('Le jeu propose aussi des évènements tout seul (« Proposition de l’agenda »). Les évènements en cours s’affichent avec un bouton pour les annuler.'),
  h2('Checkpoints'),
  etape('pnj', 'Ouvre ton checkpoint : défi, récompense et stock restant.'),
  etape('pnj', 'Le joueur relève le défi. S’il gagne, scanne sa licence dans ', b('« Licence du gagnant »'), ' : la carte arrive dans son Book.'),
  etape('pnj', b('« Joueur suivant »'), ' pour enchaîner.'),
  h2('Arène'),
  puce(b('Nouveau combattant'), ' : scanne la licence du joueur qui entre (il paie la mise de l’arène). Les combats en cours s’affichent en dessous.'),
  h2('Enchères'),
  puce(b('Mettre une carte en vente'), ' : choisis la carte (numéro ou nom) et le prix de départ ; la vente est ouverte 3 minutes. Le GM peut aussi mettre en vente une carte de Maître du jeu.'),
  h2('Missions'),
  puce('Le joueur montre sa preuve (photo, objet…) : si c’est bon, valide.'),
  h2('Alertes et Journal'),
  puce(b('Alertes'), ' : comportements suspects repérés par le jeu : déplacement trop rapide (faux GPS ?), position absente depuis longtemps, scans trop rapprochés, balise photographiée et partagée, échanges très déséquilibrés, double inscription sur le même téléphone. Le jeu ne sanctionne jamais seul : c’est à l’équipe de décider. Une alerte mène au joueur ou propose d’annuler ses gains.'),
  puce(b('Journal'), ' : tout ce qui s’est passé, avec l’auteur, le motif et l’heure. Filtres par type et par joueur.'),

  // 8. Fin
  h1('8. Le Clear et la fin'),
  etape('clear', 'Quand un joueur a toutes les cartes, son Book se fige et il vient te voir.'),
  etape('clear', 'Page ', b('Clear'), ' : scanne sa licence pour confirmer. La partie est alors terminée.'),
  etape('clear', 'Le gagnant choisit ses 3 cartes sur son téléphone ; la page affiche les ', b('lots à remettre'), '.'),
  etape('clear', 'Le ', b('classement final'), ' s’affiche (podium = 3 premiers), aussi sur l’écran géant. Si personne ne fait le Clear, termine la partie depuis le Dashboard.'),

  // 9. Problèmes
  h1('9. En cas de souci'),
  tableau(['Ce que tu vois', 'Ce qu’il faut faire'], [
    ['La console ou l’app met longtemps à répondre au début', 'Le serveur se réveille (environ 1 minute). Ouvre /sante et attends {"ok":true}.'],
    ['« HORS LIGNE » en haut de la console', 'Problème de réseau. La console se reconnecte toute seule ; sinon recharge la page.'],
    ['Plus rien ne marche, même /sante', 'Regarde Render : le service doit être « Live ». Si la base Supabase est en pause (après 7 jours sans partie), clique sur « Restore » dans Supabase.'],
    ['La caméra ne s’ouvre pas', 'Autorise la caméra dans les réglages du navigateur, ou tape le code de la licence (GQL1…).'],
    ['La vraie carte ne s’affiche pas', 'Pas de réseau : la console bascule sur le plan dessiné.'],
    ['Un PNJ a oublié son code', 'Les codes ne sont jamais réaffichés : crée-lui un nouvel accès dans Préparation → Équipe (par exemple « Wing 2 ») avec un nouveau code.'],
  ], [3600, 6038]),
];

const doc = new Document({
  creator: 'loJIC Solutions',
  title: 'Greed Island : guide de la console',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: ENCRE }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: OR, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: OR }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering,

  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Greed Island · Guide de la console · page ', { size: 18, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' })] })] }) },
    children: contenu,
  }],
});

Packer.toBuffer(doc).then((buf) => fs.writeFileSync(OUT, buf));
