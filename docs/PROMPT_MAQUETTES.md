# Prompt de maquettes — Greed Quest (à coller dans Claude, claude.ai)

> Mode d'emploi : **une conversation Claude par bloc d'écrans**. Dans chaque conversation, coller le **bloc 0** suivi d'**un seul** bloc d'écrans (1a, 1b, 1c : joueur ; 2 : PNJ ; 3 : GM ; 4 : écran géant). Une conversation par bloc évite que Claude manque de place et garde le style constant : si un premier bloc réussit, joindre sa capture aux suivants comme référence. Joindre à chaque fois 3 à 6 **captures de l'anime** (pages du Book, cartes, licence, annonces du jeu) : le style doit s'y caler. Les données affichées sont des exemples de démonstration. Rapporter ensuite les captures des maquettes dans Claude Code pour qu'il ajuste l'implémentation.

---

## Bloc 0 — Contexte et style (toujours en premier)

Tu dessines les maquettes haute fidélité d'une application web mobile appelée **Greed Quest** : une chasse au trésor sur le terrain qui reproduit le jeu **Greed Island** de l'anime *Hunter × Hunter* (version 2011). Les joueurs se déplacent dehors, en plein jour, et scannent des balises QR cachées pour obtenir des cartes numérotées qu'ils rangent dans leur **Book**. Ils se lancent des sorts quand ils sont proches (GPS), échangent des cartes, achètent des sorts, participent à des enchères et à une arène. Un Game Master pilote la partie depuis une console, des PNJ arbitrent sur le terrain, un écran géant affiche le direct.

**Style : l'univers de Greed Island, pleinement assumé, au plus près de l'anime.**
- **Immersion maximale** : le joueur doit se sentir *dans* Greed Island. Un fan de l'anime doit reconnaître chaque élément au premier coup d'œil. Les captures de l'anime jointes font foi : reproduis leurs formes, leurs couleurs et leur mise en page au plus près.
- Le **Book** est le cœur de l'application et la pièce la plus soignée. C'est le classeur de l'anime : on l'invoque (« Book ! »), il **apparaît en 3D et flotte** devant le joueur (léger mouvement de lévitation, ombre portée), il s'ouvre, et on le **feuillette page par page** au doigt avec une vraie page qui se courbe et se tourne (perspective 3D, pas un simple glissement). Chaque page porte une grille de **pochettes transparentes** numérotées, avec le reflet du plastique. Les pages « désignées » réservent une pochette à chaque carte du catalogue, dans l'ordre des numéros ; les pages « libres » reçoivent les doublons et les sorts. Une pochette vide montre son numéro en creux. Quand une carte est gagnée, elle vole jusqu'à sa pochette et s'y glisse.
- Les **cartes** reproduisent exactement l'anatomie des cartes de Greed Island : **numéro à trois chiffres en haut à gauche**, **nom en haut au centre**, **rang-limite en haut à droite** (ex. « A-12 » : rang A, 12 exemplaires au plus dans la partie), **illustration au centre**, **texte d'ambiance en bas**. Couleur du cadre : **rouge** pour les cartes désignées, **bleu** pour les cartes de sort, **jaune** pour les objets. Dos de carte commun.
- Les noms de cartes et de sorts sont **ceux de l'anime, en français** (traduction française officielle) (voir les données de démonstration).
- Les **annonces du jeu** (sort reçu, évènement, sanction) imitent la voix système de Greed Island : bandeau sobre, typographie « système », phrase courte (« Kirua a utilisé Vol sur toi. »).
- La **licence de Hunter** reprend la carte de licence de l'anime, avec un QR code au centre qui change toutes les 30 s.
- Le **Nen** : les six types en hexagone (Renforcement, Émission, Transformation, Matérialisation, Manipulation, Spécialisation), et la divination par le verre d'eau pour révéler le type.
- Les villes de Greed Island : **Masadora** (boutique de sorts), **Antokiba** (enchères), **Soufrabi** (arène).
- L'écriture Hunter (alphabet de l'anime) peut décorer les titres, toujours doublée en français.

**Contraintes**
- Tout en **français**, le joueur est tutoyé. L'équipe (PNJ, GM) lit des libellés neutres à l'infinitif (« Geler 5 min »).
- **Lisible en plein soleil** : contrastes forts, chiffres clés gros (chrono, jenny, numéros de carte), cibles tactiles d'au moins 48 px, action principale à portée du pouce en bas de l'écran.
- La lettre de rang doit rester lisible sans la couleur.
- Interdits : emojis, dégradés violet-bleu, effet verre dépoli, textes publicitaires (« Libère ton potentiel ! »), grilles de cartes génériques « icône + titre + deux lignes ».
- Les joueurs ne voient **jamais** la position des autres joueurs ni l'emplacement des balises.

**Format attendu (Claude)**
- Un **seul artifact React** (un fichier), qui affiche tous les écrans du bloc demandé.
- Un menu de démonstration à gauche (hors du cadre) liste les écrans par numéro et nom ; cliquer affiche l'écran. Pour les écrans de téléphone, un cadre de téléphone de 390 × 844 ; pour la console GM, 1440 × 900 ; pour l'écran géant, 1920 × 1080 mis à l'échelle.
- Pas d'image externe. Les **illustrations des cartes** sont des emplacements dessinés en SVG simple (silhouette de l'objet ou motif), au bon format et au bon endroit : de vraies illustrations les remplaceront.
- Polices : Google Fonts autorisées. L'écriture Hunter en décor peut être simulée par un motif, la vraie police sera ajoutée ensuite.
- Animations utiles seulement (page du Book qui se tourne, carte qui vole dans sa pochette, bandeau d'annonce qui entre), au clic dans la maquette.
- Termine par la liste des écrans produits et de ce que tu n'as pas pu faire.

**Données de démonstration**
- Partie « Greed Quest — Parc de la Villette », 120 min, 24 joueurs, il reste 47 min.
- Joueurs : Gon, Kirua, Kurapika, Leolio, Biscuit, Hisoka, Genthru, Tsezguerra.
- Catalogue de 14 cartes désignées (numéro de l'anime, nom, rang dans notre jeu, texte d'ambiance) :
  - 000 Le bonheur du détenteur (SS) : « Un château et sa ville de 10 000 habitants, qui vivent selon tes lois. »
  - 011 La balance d'or (D) : « Face à deux choix, elle penche vers le meilleur pour ton avenir. »
  - 017 Le souffle du grand ange (S) : « Guérit une personne de toutes ses blessures et maladies. Une seule fois. »
  - 021 Les lunettes squelettes (C) : « Voient à travers tout, sauf un paquet de sorts de Masadora. »
  - 025 Le dé du risque (D) : « Dix-neuf étoiles, une tête de mort. La tête de mort efface tout. »
  - 046 La jeune fille à la poudre d'or (B) : « Son bain quotidien laisse 500 g de poudre d'or. Très timide. »
  - 051 Le dragon qui s'emballe (A) : « Il t'obéit et finit par parler, si tu l'élèves avec amour. »
  - 073 Le jade des ténèbres (B) : « Béni par le Diable : il détourne le malheur sur un autre. »
  - 079 Le diamant arc-en-ciel (C) : « Demande en mariage avec lui : la réponse sera oui. »
  - 082 La canne du châtiment céleste (B) : « Nomme qui tu veux punir : le plus coupable des deux sera frappé. »
  - 083 L'épée de la vérité (C) : « Tranche en deux tout ce qui ment. »
  - 084 Le collier du chevalier (D) : « Renvoie les malédictions et lève celles des cartes qu'il touche. »
  - 094 L'épée du vol (A) : « Chaque coup réussi vole une carte à la cible. »
  - 099 Maid panda (S) : « Soigneuse, bonne cuisinière, parfaite avec les enfants. »
- Sorts (cadre bleu, nom de l'anime) : Vol (vole une carte au hasard), Échange (échange forcé d'une carte), Gel (empêche de scanner 3 min), Mur défensif (bloque le prochain sort d'attaque), Trace (zone où se trouve un joueur), Guide (zone d'une balise rare), Mimétisme (copie une carte), Pénétration (démasque les contrefaçons d'une page), Voyance (voir les cartes d'un joueur déjà croisé).
- Objets (cadre jaune) : Pépite d'or, Loterie (ticket à gratter), Boussole, Second souffle, Rideau noir (bloque Trace et Voyance), Solidité (protège une carte du vol).
- Monnaie : jenny (J).

---

## Blocs 1a, 1b, 1c — Application joueur (téléphone, 390 × 844)

Coller **en tête de chacun des trois blocs** ce rappel :
> Navigation du bas : Accueil · Scanner · Book · Sorts · Échanges. En haut, en permanence : temps restant (rouge dans les 30 dernières minutes, « Pause » si la partie est en pause), jenny, pastille de connexion.

### Bloc 1a — Entrée, accueil, scanner, Book (écrans 1 à 24)

**Entrée et inscription**
1. Rejoindre une partie : saisie du code de partie (ou arrivée par un QR d'accueil).
2. Inscription : choix du pseudo, demande d'accès à la position ; refus « Ce pseudo est déjà pris ».
3. Kit de départ : 50 J et un sort offert (carte de sort affichée).
4. Examen Hunter : 3 questions, une par écran, puis résultat (2 / 3, +20 J) avec le corrigé ; bouton « Plus tard ».
5. Test de Nen : 5 questions puis révélation du type par le verre d'eau, hexagone avec le type mis en valeur et son pouvoir.

**Accueil**
6. Accueil en partie : pseudo, type de Nen, jenny, nombre de cartes désignées (6 / 14), recharge du pouvoir de Nen, bouton « Ma licence », évènements en cours avec compte à rebours, accès « Boutique de Masadora » et « Enchères d'Antokiba ».
7. Accueil pendant un **raid de la Brigade** : carte « Raid en cours » avec la barre de vie du boss.
8. Accueil d'un joueur **gelé** (sanction ou sort Gel) : état visible avec le temps restant.
9. Licence de Hunter en plein écran avec le QR et la jauge des 30 s.

**Scanner**
10. Caméra de scan de balise (viseur, saisie manuelle du code en secours).
11. Gain : la carte tirée apparaît et vole dans le Book (ex. 051 Le dragon qui s'emballe, rang A).
12. Gain de jenny (+10 J) et d'un objet (Loterie).
13. Refus en clair : « Boucle : scanne encore 2 balises différentes », « Attends encore 26 s », « Cette balise dort », « Plus rien ici, cherche ailleurs », « Ton Book est plein ».
14. Après un refus de boucle : « Utiliser un Second souffle ? ».
15. Hors ligne : « 1 scan en attente, il sera envoyé au retour du réseau ».

**Book**
16. Book fermé qui apparaît et flotte, puis s'ouvre.
17. Première page désignée : les 10 premières pochettes dans l'ordre des numéros (000, 011, 017, 021, 025, 046, 051, 073, 079, 082), pleines ou vides, compteur 6 / 14 ; la page suivante porte les 4 dernières.
18. Pochette perdue : « Volée par Kirua à 14h05 ».
19. Page libre : doublons et cartes de sort.
20. Détail d'une carte : grande carte, provenance (« Balise », « Échange avec Leolio », « Arène de Soufrabi »), heure d'obtention ; badges éventuels : contrefaçon (pour son créateur), carte maudite, engagée dans un échange, protégée par une carte Solidité jusqu'à 15h20.
21. Contrefaçon démasquée : « Contrefaçon de Maid panda », grisée.
22. Section Objets (8 places) : Gratter une Loterie (résultat 30 J), Boussole (« La balise la plus proche est au nord-est »), Solidité (choix de la carte à protéger).
23. Book complet : bouton « Demander le Clear ».
24. Book gelé après la demande : « Va voir le Game Master ». Refus possible : « Une contrefaçon se cache en page 2 ».

### Bloc 1b — Sorts, échanges (écrans 25 à 36)

**Sorts**
25. Liste des sorts du Book regroupés (Vol ×2, Gel, Trace…), Mur défensif marqué « Passif », délai entre deux sorts offensifs (« Prochain sort offensif dans 1 min 12 »).
26. Choix d'une cible parmi les joueurs à portée (pseudos seulement), puis confirmation « Lancer Vol sur Kirua ».
27. Résultat : « Tu as volé l'épée de la vérité à Kirua » ; ou « Bloqué par son Mur défensif ».
28. Voyance : choix parmi les joueurs déjà croisés, puis la liste de leurs cartes.
29. Trace : « Hisoka était dans la zone Forêt il y a 3 min ».
30. Pouvoir de Nen (ex. Transformation : Texture Surprise, choisir un doublon et l'apparence d'une carte de même rang).
31. Pouvoir de Spécialisation : Alchimie (doublon → carte choisie), L'épée du vol (Vol sans carte, carte visée), Zetsu (invisible 10 min, minuterie), Fortune (prochain scan doublé).
32. Annonce reçue : « Kirua a utilisé Vol sur toi : tu as perdu le diamant arc-en-ciel. » ; anonyme : « Quelqu'un a consulté ton Book. »

**Échanges**
33. Proposer un échange à un joueur à portée.
34. Invitation reçue : « Leolio te propose un échange » (Accepter / Refuser).
35. Composition : ma part (cartes cochées + jenny) et la part de l'autre en direct, « ✓ validé » de chaque côté, double validation.
36. Fin : conclu, refusé, annulé, expiré.

### Bloc 1c — Villes et fin de partie (écrans 37 à 43)

**Villes**
37. Masadora : scan du QR de la boutique, achat d'un paquet de 3 sorts (50 J), revente d'une carte (prix par rang, SS invendable), Krach -50 %.
38. Antokiba : enchères en cours avec compte à rebours, « Participer » (QR du lieu), surenchère.
39. Arène de Soufrabi : défi en cours, victoire (carte A / S / SS gagnée) ou défaite (mise de 30 J perdue).
40. Raid : une question à la fois, barre de vie du boss.

**Fin**
41. Clear confirmé : le gagnant choisit 3 cartes, qui deviennent ses lots réels.
42. Partie terminée : classement final, sa place, podium des 3 premiers.
43. Abandon (menu secondaire, confirmation en deux temps).

---

## Bloc 2 — Console PNJ (téléphone, 390 × 844)

Le PNJ est debout sur le terrain, à un lieu précis (checkpoint, Antokiba, Soufrabi). Action principale toujours à un geste : **Scanner une licence**.
Barre du haut : nom de la partie, état, chrono, nombre de joueurs actifs, compteur d'alertes, nom du PNJ.

1. Connexion : code de la partie + code personnel.
2. Scanner une licence (caméra) puis fiche du joueur : pseudo, statut, type de Nen, jenny, gel en cours ; actions proposées selon le lieu.
3. Checkpoint : défi du checkpoint, stock de cartes ; réussite = choisir une carte du stock et/ou des jenny, confirmer ; mention « +1 tirage bonus (Matérialisation) ».
4. Expertise à Antokiba : une page (10 J) ou tout le Book (25 J), résultat (« 1 contrefaçon trouvée en page 2 »).
5. Arène de Soufrabi : entrée par licence (mise 30 J), défis en cours avec chrono, boutons Victoire / Défaite, annulation avec motif (mise remboursée) ; refus « Kirua a déjà tenté l'arène il y a 8 min ».
6. Enchères : ouvrir une enchère (carte du catalogue, prix de départ, 3 min), suivre les offres en direct, clôturer.
7. Missions secrètes en cours : joueur, objectif, récompense, temps restant, bouton « Valider ».
8. Liste des joueurs avec recherche (pseudo, statut, Nen, jenny), jamais de position.
9. Sanctions : Avertir, Geler 5 min, Annuler les gains d'une balise + gel ; motif obligatoire, confirmation en deux temps.
10. Alertes anti-triche : « Vitesse anormale : Hisoka, 22 km/h », « Même balise scannée par Gon et Kirua à 300 m d'écart », « Genthru sans position depuis 10 min » ; raccourci vers la sanction adaptée.
11. Journal : toutes les actions avec acteur, heure, résultat, motif ; filtres.

---

## Bloc 3 — Console Game Master (ordinateur portable, 1440 × 900 ; tablette 1024 × 768)

Vue dense, plusieurs panneaux. Inspirée de la salle de contrôle des créateurs de Greed Island. Le GM a aussi tout ce que voit un PNJ.

1. Créer une partie : nom, préréglage (Petit groupe, Standard, Grande foule), partie de démonstration, nom et code du premier GM ; ensuite les trois liens et QR (joueurs, console, écran géant).
2. Tableau de bord en partie : état (Brouillon, Inscriptions, En cours, Pause, Phase finale, Terminée) et boutons d'action selon l'état ; chrono ; joueurs actifs ; balises actives / cible ; évènements en cours ; demandes de Clear ; dernières alertes ; fil du journal.
3. Préparation (avant le démarrage), parcours en étapes avec ce qui manque pour démarrer : Zones (dessin sur la carte, type) → Balises → Catalogue (7 à 60 cartes, une seule SS, lot réel par carte, conseil « 14 cartes conseillées pour 120 min ») → Checkpoints → Paramètres → Équipe.
4. Planche d'impression A4 : QR des balises avec leur libellé, QR des lieux, QR d'accueil.
5. Carte en direct : zones, balises (dormante, active, épuisée, coupée ; standard, rare, fantôme ; stock), **positions exactes** des joueurs avec leur fraîcheur ; actions sur une balise (activer, couper, endormir, rotation forcée).
6. Paramètres : pour chaque paramètre, valeur automatique, mode (Auto / Verrouillé / Multiplicateur) et valeur appliquée ; préréglages.
7. Évènements : lancer Apparition, Double gain, Zone maudite (choix de la zone), Raid, Krach de Masadora, Carte maudite, Mission secrète (joueur, objectif, récompense) ; liste des évènements en cours avec « Annuler » ; propositions de l'agenda automatique (« Lancer » / « Ignorer »).
8. Fiche joueur : son Book complet avec la vérité sur chaque carte (contrefaçons marquées), corrections (jenny ±, ajouter / retirer une carte), disqualification ; motif obligatoire.
9. Clear : demande de Gon (Book gelé), scan de sa licence, « Confirmer le Clear » ou « Refuser » avec motif ; puis les 3 cartes choisies et les lots réels à remettre.
10. Fin de partie : classement final, podium, gagnant du Clear.

---

## Bloc 4 — Écran géant (téléviseur 1920 × 1080, lu à 8 m, aucune interaction)

Style « retransmission » du monde de Greed Island. Aucun texte plus petit que 24 px. Jamais de position nominative ni de balise localisée.

1. Avant le démarrage : grand QR d'accueil et trois lignes de consigne.
2. En partie : bandeau (nom, état, chrono géant), classement live (pseudo, cartes désignées / 14, points de rang, jenny), fil d'actualité (« Kirua a obtenu le souffle du grand ange (S) », « Gon a utilisé Vol sur Hisoka : réussi », « Quelqu'un a utilisé Voyance », « Biscuit a gagné une carte S à l'arène »), carte de chaleur anonyme décalée de 2 min, nombre de balises actives par zone.
3. Bannière d'évènement : « Apparition dans la Forêt : 08:42 ».
4. Raid de la Brigade : barre de vie géante du boss.
5. Pause : écran figé avec « Pause » bien visible.
6. Clear : plein écran avec le nom du gagnant.
7. Fin : podium des 3 premiers puis classement final.
