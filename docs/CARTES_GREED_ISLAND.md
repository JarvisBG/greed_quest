# Cartes de Greed Island — banque de référence

Sources (consultées le 2026-10-10) :
- **Noms français** : wiki français des fans, pages « Cartes d'emplacement fixe » et « Cartes à Sort » (hunterxhunter.fandom.com/fr), qui reprennent la traduction française du manga. La VF du doublage de l'anime peut différer sur quelques noms.
- Noms anglais, rangs et limites : wiki anglais des fans, page « Greed Island Card Lists » (hunterxhunter.fandom.com). Quelques limites diffèrent légèrement entre les deux wikis (049, 074, 080, 097) : sans effet, notre rang est recalculé.

**Décisions de Sivraj (2026-10-10)** :
- Les noms des cartes et des sorts sont ceux de l'anime, **en français** (traduction française du manga, d'après le wiki français).
- **Rang selon la rareté** : le rang affiché est celui de *notre* jeu, déduit de la limite d'exemplaires de l'anime (les cartes les plus courantes deviennent C ou D) ; la répartition suit `repartitionCatalogue` (≈ 10 % S, 17 % A, 20 % B, 26 % C, 26 % D). **Ruler's Blessing (000) est l'unique SS.** Le coin de la carte affiche « rang-limite » comme dans l'anime, avec la **vraie limite de la partie** (RG-8.2, dynamique), pas celle de l'anime.
- Le texte du bas de la carte est le **texte d'ambiance** de l'anime, raccourci et **réécrit en description** (décision du 2026-10-10) : jamais d'adresse au joueur ni d'impératif, pour qu'on ne le prenne pas pour un effet. Les cartes désignées sont à collectionner et n'ont aucun effet dans notre jeu ; l'app l'affiche en italique et le rappelle dans la fiche de la carte.

Anatomie d'une carte dans l'anime : numéro en haut à gauche, nom en haut au centre, rang-limite en haut à droite, illustration au centre, description en bas. Couleur du cadre : **rouge** pour les cartes désignées, **bleu** pour les sorts, **jaune** pour les cartes libres (nos objets), **noir** pour les cartes des Game Masters.

Le GM compose le catalogue d'une partie (7 à 60 cartes, `PUT /catalogue`) en piochant dans cette banque (option A, avec import d'image en secours, option B).

## 100 cartes désignées

| N° anime | Nom français | Nom anglais | Anime | Notre rang | Texte d'ambiance (FR) |
|---|---|---|---|---|---|
| 000 | Le bonheur du détenteur | Ruler's Blessing | SS-1 | **SS** | Un château et sa ville de 10 000 habitants, qui vivent selon les lois de son détenteur. |
| 001 | Le bois secret d'un Tsubo | Patch of Forest | SS-3 | S | L'entrée du Jardin du Dieu de la Montagne, peuplé d'espèces uniques et dociles. |
| 002 | La côte d'un Tsubo | Plot of Beach | SS-3 | S | L'entrée de la Caverne de Poséidon, dont le chemin change à chaque visite. |
| 003 | Le vase de la fontaine | Pitcher of Eternal Water | A-17 | B | Une jarre d'où coulent sans fin 1 440 litres d'eau pure par jour. |
| 004 | La source naturelle des belles peaux | Skin Care Hot Springs | A-15 | B | Une source chaude qui guérit toute affection de la peau. |
| 005 | La grotte des esprits | Spirited Away Hollow | S-8 | S | Une grotte d'où l'on ressort dans un lieu désolé, à l'autre bout du pays. |
| 006 | La fontaine de jouvence à alcool | Liquor Spring | A-15 | B | Une fontaine dont l'eau devient en une heure un alcool d'exception. |
| 007 | La pierre de grossesse | Pregnancy Stones | S-10 | A | Deux pierres qui donnent un enfant à qui les porte un mois, même à un homme. |
| 008 | Le lac du mystère | Mystery Pond | S-10 | A | Un étang où chaque poisson lâché devient deux le lendemain. |
| 009 | L'arbre de la bonne récolte | Tree of Plenty | S-10 | A | Un arbre chargé de tous les fruits du monde, plein à nouveau chaque matin. |
| 010 | Le rurubu d'or | Golden Guidebook | A-20 | B | Un guide doré qui dit où et quand rencontrer les personnes de son type. |
| 011 | La balance d'or | Golden Scales | B-30 | D | Une balance d'or qui, face à deux choix, penche toujours vers le meilleur. |
| 012 | Le dictionnaire d'or | Golden Dictionary | S-10 | A | Un dictionnaire dont un mot brille d'or chaque jour : il servira le lendemain. |
| 013 | Le carnet du bonheur | Luck Bankbook | A-20 | B | Un carnet où s'épargnent les petites chances du quotidien, changées en argent. |
| 014 | Les ciseaux coupe-liens | Connection Severing Scissors | B-22 | C | Des ciseaux qui coupent à jamais le lien avec la personne d'une photo découpée. |
| 015 | Le génie capricieux | Fickle Genie | S-10 | A | Un génie qui exauce trois vœux, choisis parmi mille propositions toutes différentes. |
| 016 | L'avertissement du maître des fées | Fairy King's Advice | S-6 | S | Un roi des fées qui donne de justes conseils sur ce qui manque, quand il le décide. |
| 017 | Le souffle du grand ange | Angel's Breath | SS-3 | S | Le souffle d'un ange, qui guérit toutes les blessures et toutes les maladies. Une seule fois. |
| 018 | Le petit clin d'œil du démon | Imp's Wink | A-18 | B | Un petit démon dont chaque clin d'œil procure une extase incomparable. On s'y accoutume vite. |
| 019 | L'oreiller de l'esprit joueur | Poltergeist Pillow | A-13 | B | Un oreiller qui laisse l'esprit vagabonder pendant le sommeil, 24 heures au plus. |
| 020 | Le mètre de pulsions spirituelles | Mood Clock | B-30 | D | Une horloge qui règle l'état d'esprit comme on règle l'heure. |
| 021 | Les lunettes squelettes | X-Ray Goggles | B-27 | C | Des lunettes qui voient à travers tout, sauf un paquet de sorts de Masadora. |
| 022 | Toraemon | Toraemon | A-22 | C | Une bête rare qui fourre des trésors dans sa poche à quatre dimensions. |
| 023 | Le livre infini | Tome of a Thousand Tales | B-30 | D | Un livre qui raconte une histoire différente à chaque ouverture. |
| 024 | La télé probable | Hypothetical T.V. | A-20 | B | Une télévision qui montre trente heures de ce qui se passerait si… |
| 025 | Le dé du risque | Risky Dice | B-30 | D | Un dé de dix-neuf étoiles et une tête de mort. La tête de mort efface tout. |
| 026 | Les sept nains au travail | Night Shift Dwarves | A-20 | C | Sept nains qui abattent tout le travail pendant le sommeil de leur maître. |
| 027 | Le carnet de ticket de bus-visage | Book of V.I.P Passes | B-25 | C | Un carnet de mille passes qui ouvrent toutes les portes. |
| 028 | La télécommande à sentiments | Capricious Remote | B-27 | C | Une télécommande qui règle ce qu'une personne ressent pour une autre. |
| 029 | Coupon de réservation forcée | Pre-Order Vouchers | A-20 | C | Un coupon qui obtient n'importe quel produit, si rare soit-il. |
| 030 | Coussin connexion | Favor Cushion | B-21 | C | Un coussin : qui s'y assied rend un service à son propriétaire. |
| 031 | Carte postale aller-retour pour les morts | Double Postcard to the Dead | S-13 | B | Une carte postale pour écrire à un défunt, qui répond le lendemain. |
| 032 | Le bonbon mainate | Parrot Candy | B-30 | D | Un bonbon qui donne la voix de son choix. |
| 033 | Cookie aux hormones | Hormone Cookies | S-13 | B | Un biscuit qui change de sexe pendant 24 heures. |
| 034 | Enquête sur tout | Universal Survey | B-30 | D | Un questionnaire auquel on répond toujours avec franchise. |
| 035 | Kit caméléon | Chameleon Cat | S-6 | S | Un kit qui change en n'importe quel animal, sans changer de masse. |
| 036 | La salle de recyclage | Recycling Room | S-10 | A | Une salle où ce qui est cassé ressort neuf 24 heures plus tard. |
| 037 | L'œuf du sportif de niveau extra-super | Fledgling Athlete | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand athlète. |
| 038 | L'œuf de l'artiste de niveau extra-super | Fledgling Artist | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand artiste. |
| 039 | L'œuf du politicien de niveau extra-super | Fledgling Politician | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand politicien. |
| 040 | L'œuf du musicien de niveau extra-super | Fledgling Musician | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand musicien. |
| 041 | L'œuf du pilote de niveau extra-super | Fledgling Pilot | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand pilote. |
| 042 | L'œuf du romancier de niveau extra-super | Fledgling Novelist | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand romancier. |
| 043 | L'œuf du grand gambler | Fledgling Gambler | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand joueur. |
| 044 | L'œuf du grand acteur | Fledgling Actor | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand acteur. |
| 045 | L'œuf du grand patron | Fledgling CEO | B-30 | D | Un œuf qui, couvé des années, fait de son gardien un grand patron. |
| 046 | La jeune fille à la poudre d'or | Gold Dust Girl | A-13 | B | Une jeune fille dont le bain quotidien laisse 500 g de poudre d'or. Très timide. |
| 047 | La jeune fille endormie | Sleeping Girl | A-11 | A | Une jeune fille qui dort à la place de son maître, éveillé jour et nuit. |
| 048 | La jeune fille parfumée | Aromatherapy Girl | A-15 | B | Une jeune fille dont le parfum chasse tout le stress. |
| 049 | La sirène qui s'emballe | Miniature Mermaid | A-23 | C | Une sirène qui tient dans la main et chante quand elle est heureuse. |
| 050 | Le zaurus qui s'emballe | Miniature Dino | A-11 | A | Un petit saurien dont chaque génération donne une nouvelle espèce. |
| 051 | Le dragon qui s'emballe | Miniature Dragon | S-10 | A | Un petit dragon qui obéit à son maître et finit par parler, s'il est élevé avec amour. |
| 052 | La perle de sauterelle | Pearl Locusts | B-30 | D | Des criquets qui cachent chacun une perle. |
| 053 | King white ookuwagata | King White Stag Beetle | A-30 | D | Un scarabée blanc qui bâtit une immense colonie d'insectes. |
| 054 | Le papillon millénaire | Millennium Butterfly | A-25 | C | Un papillon : qui le capture fait prospérer sa famille pour des générations. |
| 055 | La boutique des contreparties | Revenge Shop | A-20 | C | Une boutique dont le gérant se venge à la mesure de la rancune de son client. |
| 056 | La galerie de photos souvenirs | Perfect Memory Studio | B-25 | C | Une galerie qui tire le portrait de son visiteur à n'importe quel moment de son passé. |
| 057 | L'agent immobilier de maisons cachées | Hideout Realtor | A-11 | A | Une agence qui loue une pièce secrète, connue de son seul locataire. |
| 058 | Le vidéo club secret | Secrets Video Rental | A-13 | B | Un vidéo club qui loue les secrets des autres, sans jamais les montrer. |
| 059 | L'école des langues étrangères instantanées | Instant Foreign Language School | A-20 | C | Une école où des années d'étude se changent en quelques minutes de parfaite maîtrise. |
| 060 | Le livreur d'objets perdus | Long Lost Delivery | B-30 | D | Un livreur qui rapporte le lendemain tout objet perdu qu'on lui décrit. |
| 061 | Le chien en pièces | Vending Check-Up | A-20 | C | Un chien qui fait un bilan de santé complet : « Rien à signaler » ou « Anomalie ». |
| 062 | Le roi des clubs | Club "You Rule" | B-20 | C | Un club où tout le monde obéit au roi ; une heure dedans vaut un jour dehors. |
| 063 | Le restaurant virtuel | Virtual Restaurant | B-30 | D | Un restaurant où l'on commande de tout. La satiété n'y est qu'une illusion. |
| 064 | L'élixir de la sorcière | Witch's Love Potion | B-30 | D | La pilule d'amour d'une sorcière : qui l'avale aime une semaine durant. |
| 065 | L'élixir de jeunesse de la sorcière | Witch's Rejuvenation Potion | S-10 | A | Les pilules de jeunesse d'une sorcière, un an de moins chacune. Gare à l'excès. |
| 066 | L'amaigrissant de la sorcière | Witch's Diet Pills | B-28 | C | Les pilules amincissantes d'une sorcière, un kilo de moins chacune. |
| 067 | Le médicament de croissance | Doyen's Growth Pills | B-30 | D | Des pilules de croissance, un centimètre de plus chacune. |
| 068 | Le médicament de renforcement mental | Doyen's Virility Pills | A-20 | C | Un remède qui décuple l'endurance et l'ardeur. |
| 069 | Le médicament de repousse des cheveux du vieillard | Doyen's Hair Restorer | B-30 | D | Une lotion qui fait pousser des cheveux partout où elle touche. À manier avec des gants. |
| 070 | La pastille de renforcement musculaire du professeur fou | Mad Scientist's Steroids | A-16 | B | Des pastilles qui donnent des muscles sans effort, au goût atroce. |
| 071 | La pommade d'hormones du professeur fou | Mad Scientist's Pheromones | A-20 | C | Une pommade qui attire irrésistiblement… parfois un peu trop. |
| 072 | La machine de remodelage du professeur fou | Mad Scientist's Plastic Surgery | A-15 | B | Une machine qui remodèle le visage à volonté. Une fois sur vingt, elle échoue. |
| 073 | Le jade des ténèbres | Night Jade | A-15 | B | Un jade béni par le Diable, qui détourne le malheur sur un autre. |
| 074 | L'aigue-marine philosophale | Sage's Aquamarine | A-11 | A | Une aigue-marine qui entoure son porteur d'amis brillants et fidèles toute sa vie. |
| 075 | L'alexandrite de la chance | Wild Luck Alexandrite | A-20 | C | Une alexandrite qui attire des expériences uniques, pour le meilleur ou pour le pire. |
| 076 | Le rubis du destin | Roaming Ruby | B-30 | D | Un rubis qui apporte une immense fortune, mais jamais plus d'une semaine au même endroit. |
| 077 | L'émeraude qui attire la beauté | Beauty Magnet Emerald | S-10 | A | Une émeraude qui fait accourir les experts de la beauté. |
| 078 | Le saphir solitaire | Lonely Sapphire | B-30 | D | Un saphir qui apporte une immense fortune, et une vie entière de solitude. |
| 079 | Le diamant arc-en-ciel | Rainbow Diamond | A-20 | C | Le diamant des demandes en mariage : la réponse est toujours oui. |
| 080 | La pierre flottante | Levitation Stone | S-7 | S | Une pierre nourrie par le soleil, qui fait flotter une personne. |
| 081 | Blue planet | Blue Planet | SS-5 | S | Un joyau bleu inconnu de la science, tombé de l'espace. |
| 082 | La canne du châtiment céleste | Staff of Judgment | A-15 | B | Une canne qui frappe le plus coupable des deux noms prononcés. |
| 083 | L'épée de la vérité | Sword of Truth | B-22 | C | Une épée qui tranche en deux tout ce qui ment. |
| 084 | Le collier du chevalier | Paladin's Necklace | D-60 | D | Un collier qui renvoie les malédictions et lève celles des cartes qu'il touche. |
| 085 | L'armure de remplacement de corps | Scapegoat/Sacrifice Armor | S-8 | A | Une armure contre laquelle toute arme issue d'une carte reste vaine. |
| 086 | L'arc de l'échec | Quiver of Frustration | A-11 | A | Un arc dont chaque flèche vaut une « Évasion ». |
| 087 | Le bouclier des prières | Shield of Faith | S-15 | B | Un bouclier qui bloque les sorts de déplacement à 20 mètres. |
| 088 | Le grand marteau de l'immortalité | Eternal Hammer | A-15 | B | Un marteau dont chaque coup frappe d'un sort d'attaque impossible à parer. |
| 089 | La manchette de l'inspecteur du fisc | Tax Collector's Gauntlet | A-20 | C | La manchette d'un inspecteur du fisc, qui saisit au prix d'une carte de son porteur. |
| 090 | Le casque de mémoire | Memory Helmet | A-20 | C | Un casque qui fait garder en mémoire tout ce qu'on voit et entend. |
| 091 | Plaking | Plastic King | A-20 | C | Une maquette qui devient n'importe quel véhicule. |
| 092 | Le ticket de kagemusha | Swap Ticket | S-7 | S | Un ticket pour vivre la vie de quelqu'un d'autre pendant 24 heures. |
| 093 | L'encyclopédie de la vie | Book of Life | B-28 | D | Une encyclopédie de tous ceux qui ont croisé une vie, et de leurs conversations. |
| 094 | L'épée du vol | Bandit's Blade | S-10 | A | Une épée légendaire dont chaque coup vole une carte. |
| 095 | Le manteau du secret | Secret Cape | A-20 | C | Un manteau qui protège le Book de son porteur de tout regard indiscret. |
| 096 | Le serpent aux yeux de mille miles | Clairvoyant Snake | A-12 | B | Un serpent qui, nourri d'une carte, crache une « Sup'vision ». |
| 097 | Caméra 3D | 3-D Camera | A-20 | C | Un appareil dont les photos se développent en objets en relief. |
| 098 | Silver dog | Silver Dog | S-8 | A | Un chien d'argent qui, nourri d'or, produit de l'argent massif. |
| 099 | Maid panda | Panda Maid | S-6 | S | Une servante panda, soigneuse, bonne cuisinière, parfaite avec les enfants. |

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
