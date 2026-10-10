# Cartes de Greed Island — banque de référence

Sources (consultées le 2026-10-10) :
- **Noms français** : wiki français des fans, pages « Cartes d'emplacement fixe » et « Cartes à Sort » (hunterxhunter.fandom.com/fr), qui reprennent la traduction française du manga. La VF du doublage de l'anime peut différer sur quelques noms.
- Noms anglais, rangs et limites : wiki anglais des fans, page « Greed Island Card Lists » (hunterxhunter.fandom.com). Quelques limites diffèrent légèrement entre les deux wikis (049, 074, 080, 097) : sans effet, notre rang est recalculé.

**Décisions de Sivraj (2026-10-10)** :
- Les noms des cartes et des sorts sont ceux de l'anime, **en français** (traduction française du manga, d'après le wiki français).
- **Rang selon la rareté** : le rang affiché est celui de *notre* jeu, déduit de la limite d'exemplaires de l'anime (les cartes les plus courantes deviennent C ou D) ; la répartition suit `repartitionCatalogue` (≈ 10 % S, 17 % A, 20 % B, 26 % C, 26 % D). **Ruler's Blessing (000) est l'unique SS.** Le coin de la carte affiche « rang-limite » comme dans l'anime, avec la **vraie limite de la partie** (RG-8.2, dynamique), pas celle de l'anime.
- Le texte du bas de la carte est le **texte d'ambiance** de l'anime, raccourci : il n'a aucun effet dans notre jeu.

Anatomie d'une carte dans l'anime : numéro en haut à gauche, nom en haut au centre, rang-limite en haut à droite, illustration au centre, description en bas. Couleur du cadre : **rouge** pour les cartes désignées, **bleu** pour les sorts, **jaune** pour les cartes libres (nos objets), **noir** pour les cartes des Game Masters.

Le GM compose le catalogue d'une partie (7 à 60 cartes, `PUT /catalogue`) en piochant dans cette banque (option A, avec import d'image en secours, option B).

## 100 cartes désignées

| N° anime | Nom français | Nom anglais | Anime | Notre rang | Texte d'ambiance (FR) |
|---|---|---|---|---|---|
| 000 | Le bonheur du détenteur | Ruler's Blessing | SS-1 | **SS** | Un château et sa ville de 10 000 habitants, qui vivent selon tes lois. |
| 001 | Le bois secret d'un Tsubo | Patch of Forest | SS-3 | S | L'entrée du Jardin du Dieu de la Montagne, peuplé d'espèces uniques et dociles. |
| 002 | La côte d'un Tsubo | Plot of Beach | SS-3 | S | L'entrée de la Caverne de Poséidon, dont le chemin change à chaque visite. |
| 003 | Le vase de la fontaine | Pitcher of Eternal Water | A-17 | B | Une jarre d'où coulent sans fin 1 440 litres d'eau pure par jour. |
| 004 | La source naturelle des belles peaux | Skin Care Hot Springs | A-15 | B | Une source qui guérit toute affection de la peau. |
| 005 | La grotte des esprits | Spirited Away Hollow | S-8 | S | Entre, ressors : te voilà dans un lieu désolé du pays. |
| 006 | La fontaine de jouvence à alcool | Liquor Spring | A-15 | B | Son eau devient en une heure un alcool d'exception. |
| 007 | La pierre de grossesse | Pregnancy Stones | S-10 | A | Porte-les un mois et tu attends un enfant, même si tu es un homme. |
| 008 | Le lac du mystère | Mystery Pond | S-10 | A | Chaque poisson qu'on y lâche est deux le lendemain. |
| 009 | L'arbre de la bonne récolte | Tree of Plenty | S-10 | A | Un arbre chargé de tous les fruits, plein à nouveau chaque matin. |
| 010 | Le rurubu d'or | Golden Guidebook | A-20 | B | Où et quand rencontrer les personnes qui sont ton type. |
| 011 | La balance d'or | Golden Scales | B-30 | D | Face à deux choix, elle penche vers le meilleur pour ton avenir. |
| 012 | Le dictionnaire d'or | Golden Dictionary | S-10 | A | Chaque jour, un mot brille d'or : il te servira demain. |
| 013 | Le carnet du bonheur | Luck Bankbook | A-20 | B | Épargne tes petites chances du quotidien et convertis-les en argent. |
| 014 | Les ciseaux coupe-liens | Connection Severing Scissors | B-22 | C | Découpe une photo de quelqu'un : tu ne le reverras jamais. |
| 015 | Le génie capricieux | Fickle Genie | S-10 | A | Trois vœux, choisis parmi mille propositions toutes différentes. |
| 016 | L'avertissement du maître des fées | Fairy King's Advice | S-6 | S | Des conseils justes sur ce qui te manque, quand il le décide. |
| 017 | Le souffle du grand ange | Angel's Breath | SS-3 | S | Guérit une personne de toutes ses blessures et maladies. Une seule fois. |
| 018 | Le petit clin d'œil du démon | Imp's Wink | A-18 | B | Une extase incomparable à chaque clin d'œil. Attention à l'accoutumance. |
| 019 | L'oreiller de l'esprit joueur | Poltergeist Pillow | A-13 | B | Ton esprit vagabonde pendant ton sommeil. Reviens avant 24 heures. |
| 020 | Le mètre de pulsions spirituelles | Mood Clock | B-30 | D | Règle ton état d'esprit comme une horloge. |
| 021 | Les lunettes squelettes | X-Ray Goggles | B-27 | C | Voient à travers tout, sauf un paquet de sorts de Masadora. |
| 022 | Toraemon | Toraemon | A-22 | C | Une bête rare qui fourre des trésors dans sa poche à quatre dimensions. |
| 023 | Le livre infini | Tome of a Thousand Tales | B-30 | D | Une histoire différente à chaque ouverture. |
| 024 | La télé probable | Hypothetical T.V. | A-20 | B | Montre trente heures de ce qui se passerait si… |
| 025 | Le dé du risque | Risky Dice | B-30 | D | Dix-neuf étoiles, une tête de mort. La tête de mort efface tout. |
| 026 | Les sept nains au travail | Night Shift Dwarves | A-20 | C | Ils font ton travail pendant que tu dors. |
| 027 | Le carnet de ticket de bus-visage | Book of V.I.P Passes | B-25 | C | Mille passes pour entrer partout. |
| 028 | La télécommande à sentiments | Capricious Remote | B-27 | C | Règle ce qu'une personne ressent pour une autre. |
| 029 | Coupon de réservation forcée | Pre-Order Vouchers | A-20 | C | Obtiens n'importe quel produit, si rare soit-il. |
| 030 | Coussin connexion | Favor Cushion | B-21 | C | Qui s'y assied te rend un service. |
| 031 | Carte postale aller-retour pour les morts | Double Postcard to the Dead | S-13 | B | Écris à un défunt, il te répond le lendemain. |
| 032 | Le bonbon mainate | Parrot Candy | B-30 | D | Prends n'importe quelle voix. |
| 033 | Cookie aux hormones | Hormone Cookies | S-13 | B | Change de sexe pendant 24 heures. |
| 034 | Enquête sur tout | Universal Survey | B-30 | D | On y répond toujours avec franchise. |
| 035 | Kit caméléon | Chameleon Cat | S-6 | S | Se change en n'importe quel animal, sans changer de masse. |
| 036 | La salle de recyclage | Recycling Room | S-10 | A | Ce qui est cassé en ressort neuf 24 heures plus tard. |
| 037 | L'œuf du sportif de niveau extra-super | Fledgling Athlete | B-30 | D | Couve-le des années : tu deviendras un grand athlète. |
| 038 | L'œuf de l'artiste de niveau extra-super | Fledgling Artist | B-30 | D | Couve-le des années : tu deviendras un grand artiste. |
| 039 | L'œuf du politicien de niveau extra-super | Fledgling Politician | B-30 | D | Couve-le des années : tu deviendras un grand politicien. |
| 040 | L'œuf du musicien de niveau extra-super | Fledgling Musician | B-30 | D | Couve-le des années : tu deviendras un grand musicien. |
| 041 | L'œuf du pilote de niveau extra-super | Fledgling Pilot | B-30 | D | Couve-le des années : tu deviendras un grand pilote. |
| 042 | L'œuf du romancier de niveau extra-super | Fledgling Novelist | B-30 | D | Couve-le des années : tu deviendras un grand romancier. |
| 043 | L'œuf du grand gambler | Fledgling Gambler | B-30 | D | Couve-le des années : tu deviendras un grand joueur. |
| 044 | L'œuf du grand acteur | Fledgling Actor | B-30 | D | Couve-le des années : tu deviendras un grand acteur. |
| 045 | L'œuf du grand patron | Fledgling CEO | B-30 | D | Couve-le des années : tu deviendras un grand patron. |
| 046 | La jeune fille à la poudre d'or | Gold Dust Girl | A-13 | B | Son bain quotidien laisse 500 g de poudre d'or. Très timide. |
| 047 | La jeune fille endormie | Sleeping Girl | A-11 | A | Elle dort à ta place : tu restes éveillé 24 heures sur 24. |
| 048 | La jeune fille parfumée | Aromatherapy Girl | A-15 | B | Son parfum chasse tout ton stress. |
| 049 | La sirène qui s'emballe | Miniature Mermaid | A-23 | C | Une sirène qui tient dans la main et chante quand elle est heureuse. |
| 050 | Le zaurus qui s'emballe | Miniature Dino | A-11 | A | Chaque génération donne une nouvelle espèce. |
| 051 | Le dragon qui s'emballe | Miniature Dragon | S-10 | A | Il t'obéit et finit par parler, si tu l'élèves avec amour. |
| 052 | La perle de sauterelle | Pearl Locusts | B-30 | D | Chaque criquet cache une perle. |
| 053 | King white ookuwagata | King White Stag Beetle | A-30 | D | Il bâtit une immense colonie d'insectes. |
| 054 | Le papillon millénaire | Millennium Butterfly | A-25 | C | Qui le capture fait prospérer sa famille pour des générations. |
| 055 | La boutique des contreparties | Revenge Shop | A-20 | C | Le gérant se venge pour toi, à la mesure de ta rancune. |
| 056 | La galerie de photos souvenirs | Perfect Memory Studio | B-25 | C | Une photo de toi à n'importe quel moment de ton passé. |
| 057 | L'agent immobilier de maisons cachées | Hideout Realtor | A-11 | A | Une pièce secrète rien que pour toi. N'en parle à personne. |
| 058 | Le vidéo club secret | Secrets Video Rental | A-13 | B | Loue les secrets des autres, sans jamais les montrer. |
| 059 | L'école des langues étrangères instantanées | Instant Foreign Language School | A-20 | C | Le temps d'étude se change en minutes de parfaite maîtrise. |
| 060 | Le livreur d'objets perdus | Long Lost Delivery | B-30 | D | Décris l'objet perdu, il arrive le lendemain. |
| 061 | Le chien en pièces | Vending Check-Up | A-20 | C | Un bilan complet pour 500 J : « Rien à signaler » ou « Anomalie ». |
| 062 | Le roi des clubs | Club "You Rule" | B-20 | C | Tout le monde t'obéit ; une heure dedans vaut un jour dehors. |
| 063 | Le restaurant virtuel | Virtual Restaurant | B-30 | D | Commande tout ce que tu veux. La satiété n'est qu'une illusion. |
| 064 | L'élixir de la sorcière | Witch's Love Potion | B-30 | D | Embrasse la pilule, fais-la boire : on t'aime une semaine. |
| 065 | L'élixir de jeunesse de la sorcière | Witch's Rejuvenation Potion | S-10 | A | Un an de moins par pilule. N'en prends pas plus que ton âge. |
| 066 | L'amaigrissant de la sorcière | Witch's Diet Pills | B-28 | C | Un kilo de moins par pilule. |
| 067 | Le médicament de croissance | Doyen's Growth Pills | B-30 | D | Un centimètre de plus par pilule. |
| 068 | Le médicament de renforcement mental | Doyen's Virility Pills | A-20 | C | Endurance et ardeur décuplées. |
| 069 | Le médicament de repousse des cheveux du vieillard | Doyen's Hair Restorer | B-30 | D | Les cheveux poussent partout où on l'applique. Mets des gants. |
| 070 | La pastille de renforcement musculaire du professeur fou | Mad Scientist's Steroids | A-16 | B | Des muscles sans effort, mais un goût atroce. |
| 071 | La pommade d'hormones du professeur fou | Mad Scientist's Pheromones | A-20 | C | Attire irrésistiblement… parfois un peu trop. |
| 072 | La machine de remodelage du professeur fou | Mad Scientist's Plastic Surgery | A-15 | B | Le visage de ton choix. 5 % de risques d'échec. |
| 073 | Le jade des ténèbres | Night Jade | A-15 | B | Béni par le Diable : il détourne le malheur sur un autre. |
| 074 | L'aigue-marine philosophale | Sage's Aquamarine | A-11 | A | Des amis brillants et fidèles toute ta vie. |
| 075 | L'alexandrite de la chance | Wild Luck Alexandrite | A-20 | C | Des expériences uniques, pour le meilleur ou pour le pire. |
| 076 | Le rubis du destin | Roaming Ruby | B-30 | D | Une immense fortune, mais jamais plus d'une semaine au même endroit. |
| 077 | L'émeraude qui attire la beauté | Beauty Magnet Emerald | S-10 | A | Les experts de la beauté accourent vers toi. |
| 078 | Le saphir solitaire | Lonely Sapphire | B-30 | D | Une immense fortune, et une vie entière de solitude. |
| 079 | Le diamant arc-en-ciel | Rainbow Diamond | A-20 | C | Demande en mariage avec lui : la réponse sera oui. |
| 080 | La pierre flottante | Levitation Stone | S-7 | S | Elle fait flotter une personne, nourrie par le soleil. |
| 081 | Blue planet | Blue Planet | SS-5 | S | Un joyau bleu inconnu de la science : un cadeau de l'espace. |
| 082 | La canne du châtiment céleste | Staff of Judgment | A-15 | B | Nomme qui tu veux punir : le plus coupable des deux sera frappé. |
| 083 | L'épée de la vérité | Sword of Truth | B-22 | C | Tranche en deux tout ce qui ment. |
| 084 | Le collier du chevalier | Paladin's Necklace | D-60 | D | Renvoie les malédictions et lève celles des cartes qu'il touche. |
| 085 | L'armure de remplacement de corps | Scapegoat/Sacrifice Armor | S-8 | A | Rend vaine toute arme issue d'une carte. |
| 086 | L'arc de l'échec | Quiver of Frustration | A-11 | A | Autant d'« Évasion » que de flèches. |
| 087 | Le bouclier des prières | Shield of Faith | S-15 | B | Bloque les sorts de déplacement à 20 mètres. |
| 088 | Le grand marteau de l'immortalité | Eternal Hammer | A-15 | B | Chaque coup inflige un sort d'attaque impossible à parer. |
| 089 | La manchette de l'inspecteur du fisc | Tax Collector's Gauntlet | A-20 | C | Lance « Collection », au prix d'une de tes cartes. |
| 090 | Le casque de mémoire | Memory Helmet | A-20 | C | Tu n'oublies rien de ce que tu vois ou entends. |
| 091 | Plaking | Plastic King | A-20 | C | Une maquette qui devient n'importe quel véhicule. |
| 092 | Le ticket de kagemusha | Swap Ticket | S-7 | S | Vis la vie de quelqu'un pendant 24 heures. |
| 093 | L'encyclopédie de la vie | Book of Life | B-28 | D | Tous ceux qui ont croisé ta vie, et vos conversations. |
| 094 | L'épée du vol | Bandit's Blade | S-10 | A | Chaque coup réussi vole une carte à la cible. |
| 095 | Le manteau du secret | Secret Cape | A-20 | C | Tant que tu la portes, on ne peut pas épier ton Book. |
| 096 | Le serpent aux yeux de mille miles | Clairvoyant Snake | A-12 | B | Nourris-le d'une carte C ou plus : il crache une « Sup'vision ». |
| 097 | Caméra 3D | 3-D Camera | A-20 | C | Les photos se développent en objets en relief. |
| 098 | Silver dog | Silver Dog | S-8 | A | Nourri d'or, il produit de l'argent massif. |
| 099 | Maid panda | Panda Maid | S-6 | S | Soigneuse, bonne cuisinière, parfaite avec les enfants. |

## Nos sorts → sorts de l'anime

Nos effets ne changent pas (règles RG-10) ; seuls les noms affichés changent. Les identifiants internes (`vol`, `gel`…) restent.

| Notre sort (règle) | Nom français (anime) | Nom anglais | N° | Correspondance |
|---|---|---|---|---|
| Vol | **Vol** | Thief | 1007 | Vole une carte au hasard dans les emplacements fixes de la cible |
| Échange forcé | **Échange** | Trade | 1008 | Échange une de tes cartes contre une des siennes au hasard |
| Gel | **Gel** (création) | — | — | Aucun équivalent : l'anime n'a aucun sort qui entrave un joueur |
| Barrière | **Mur défensif** | Defensive Wall | 1003 | Pare une fois un sort offensif |
| Radar | **Trace** | Trace | 1027 | Position d'un joueur (chez nous : sa zone) |
| Révélation | **Guide** | Guidepost | 1030 | Lieu d'un objet (chez nous : la zone d'une balise rare) |
| Duplication | **Mimétisme** | Mimic | 1010 | Copie une carte ; échoue à la limite (chez nous : contrefaçon) |
| Analyse | **Pénétration** | Dispel | 1024 | Rend leur forme originale aux cartes transformées (chez nous : une page) |
| Regard | **Voyance** | Peek | 1001 | Voit les emplacements libres d'un joueur déjà rencontré |

Sorts ajoutés par les amendements du 2026-10-10 (REGLES.md) :

| Sort | Nom anglais | N° anime | Effet chez nous |
|---|---|---|---|
| **Pickpocket** | Pickpocket | 1006 | Vole une carte au hasard dans les emplacements libres |
| **Clairvoyance** | Fluoroscopy | 1002 | Voit les emplacements fixes d'un joueur déjà croisé (Voyance : les libres) |
| **Accompagnement** | Accompany | 1039 | Position exacte d'un joueur déjà croisé pendant 3 min, et il est gelé 3 min |
| **Retour** | Return | 1009 | Utiliser à distance une ville déjà visitée |

## Autres correspondances

| Chez nous | Nom français (anime) | Nom anglais |
|---|---|---|
| Contrefaçon | **Contrefaçon** (sort 1020) | Fake |
| Voile d'ombre (objet) | **Rideau noir** (sort 1025) | Blackout Curtain |
| Coffre scellé (objet) | **Solidité** (sort 1035) | Fortress |
| Ticket de la Fortune (objet) | **Loterie** (sort 1032) | Lottery |
| Pépite d'or (objet) | **Pépite d'or** (création ; l'anime a une carte « 10 000 J ») | J10,000 |
| Boussole du chercheur (objet) | **Boussole** (création) | — |
| Second souffle (objet) | **Second souffle** (création) | — |
| Pouvoir Bandit (Spécialisation) | **L'épée du vol** (carte 094) | Bandit's Blade |
| Texture Surprise (Transformation) | **Texture Surprise** (pouvoir de Hisoka) | Texture Surprise |
| Book | **Classeur** (on l'invoque en disant « Book ») | Binder |

## Points à trancher par Sivraj
1. Signaler un nom qui diffère de la VF que les joueurs connaissent (doublage de l'anime).
2. ~~Numérotation~~ : **décidé le 2026-10-10**, amendement RG-8.1 (numéro de l'anime sur la carte, Book dans cet ordre).
