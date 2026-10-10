# Simulation de calibrage

Commande : `pnpm --filter @gq/engine sim [graines] [option=valeur …]`
ex. `pnpm --filter @gq/engine sim 20 balisesParJoueur=0.75 multLimites=2 probaCheckpoint=0.1`
Code : `packages/engine/src/sim/`. Toutes les règles viennent du vrai moteur. 20 parties par taille, 150 min.

## Modèle (v2, 2026-10-09)
- Chaque joueur marche 1 à 3 min vers une balise **au hasard** (il ne sait pas lesquelles sont actives, RG-6.5) et scanne.
- À chaque action, 30 % de chances de croiser un joueur à portée : sort offensif (Vol, sinon Échange forcé avec un doublon, sinon Gel), puis échange 1 contre 1 de doublons, ou achat d'un de ses doublons qui me manque (2 × prix de revente).
- Barrière gardée ; Radar, Révélation, Duplication, Analyse utilisés aussitôt sans effet modélisé.
- Masadora (Livre presque plein ou ≥ 150 J) : revente des doublons hors SS, achat de paquets de sorts.
- Le GM lance une Apparition toutes les 15 min (seule source de SS).
- Option `probaCheckpoint` : à chaque action, chance de réussir un checkpoint PNJ donnant une carte B / A / S (50 / 35 / 15). **Le document ne chiffre pas ces sources** (PNJ, énigmes, enchères, Soufrabi).
- **Non modélisé** : céder une carte de son propre Livre (non doublon) contre des jenny, enchères, contrefaçons, autres événements. J = nombre de joueurs (tous actifs).

## Résultats

| Réglages | Joueurs | Clear | Meilleur /30 | Moyenne /30 | Tirages / joueur | Manques du meilleur |
|---|---|---|---|---|---|---|
| **Document** (40 balises, limites × 1, pas de checkpoint) | 10 | 0/20 | 11 | 7,3 | 8,7 | tous rangs |
| | 30 | 0/20 | 15 | 10,1 | 16,1 | tous rangs |
| | 80 | 0/20 | 16 | 10,3 | 40,4 | tous rangs |
| 1,5 balise/joueur, limites × 2 | 10 / 30 / 80 | 0/20 | 18 / 16 / 18 | 15 / 11 / 12 | 22 / 15 / 16 | surtout SS, S, A |
| 1,5 balise/joueur, limites × 2, checkpoint 10 % | 10 / 30 / 80 | 0/20 | 24 / 21 / 22 | 20 / 15 / 16 | 22 / 14 / 16 | SS 1,7, S 1,7, A 1,5 |
| **0,75 balise/joueur, limites × 2, checkpoint 10 %** | 10 / 30 / 80 | 0/20 | **23 / 24 / 24** | **20 / 19 / 20** | 26 / 27 / 31 | **SS 1,8, S 1,8, A 1,3** ; B, C, D ≈ complets |

Au-delà de × 2, multiplier les limites ne change plus rien : plus aucun tirage n'est bloqué par une limite.

## Constats
1. **Avec les réglages du document, personne ne dépasse ~15/30**, et c'est structurel : les limites RG-14 n'autorisent que ~10-12 exemplaires par joueur en jeu (117 pour 10 joueurs, 311 pour 30, 834 pour 80).
2. **Les limites × 2 suffisent** à lever ce blocage.
3. **Trop de balises posées étouffe le jeu.** Avec `balisesActives = J/3`, poser 1,5 balise par joueur laisse 75 % des scans tomber sur une balise dormante (≈ 15 tirages par joueur en 150 min). **≈ 0,75 balise posée par joueur** double le rythme de tirage tout en gardant la rotation.
4. **Les balises seules ne donnent presque pas de hauts rangs** (A 4 % des tirages, S seulement en balise rare, SS seulement en Apparition). Sans sources PNJ chiffrées, le meilleur joueur bute sur S et A.
5. **Les SS sont le verrou final** : même dans le meilleur scénario, il manque presque toujours les 2 SS au meilleur joueur. Une SS ne se revend pas, n'existe qu'en 1 ou 2 exemplaires, et sort d'une Apparition au hasard de qui passe : le gagnant doit l'obtenir de son détenteur (vol, échange), ce que le simulateur modélise mal.

## Stock des checkpoints (2026-10-09, 10 graines, 0,75 balise/joueur, limites × 2)
`probaCheckpoint` = chance par action ; ≈ 26-31 actions par joueur.

| probaCheckpoint | Cartes de checkpoint / joueur | Meilleur /30 (10 / 30 / 80 joueurs) |
|---|---|---|
| 0 | 0 | 17 / 21 / 23 |
| 0,02 | ≈ 0,6 | 19 / 22 / 24 |
| 0,04 | ≈ 1,2 | 20 / 23 / 25 |
| 0,1 | ≈ 2,6 | 23 / 24 / 24 |

Conseil retenu : ≈ 1,5 carte de checkpoint par joueur attendu. Il manque toujours ≈ 2 SS au meilleur joueur : d'où l'arène de Soufrabi et les enchères de SS (non modélisées).

## Arène de Soufrabi et enchères de SS (2026-10-09, 10 graines)
Modèle : à chaque action, un joueur à qui il manque une carte A / S / SS va à l'arène avec la probabilité `probaArene` (à la place d'un scan), s'il en a le droit (`enterArena` : mise 30 J, une tentative / 15 min) ; il gagne avec `probaVictoireArene` (0,5) et tire alors une carte A / S / SS (`arenaReward`). Toutes les `encheresSSToutesLesMin`, le PNJ met aux enchères une SS encore sous sa limite (départ `prixDepartEnchereSS`, 50 J) ; chaque joueur à qui elle manque vient avec la probabilité `probaVenirEnchere` (0,3) et y passe les 3 min ; enchère à l'anglaise, chacun prêt à miser tous ses jenny (`openAuction`, `placeBid`, `closeAuction`). Options désactivées par défaut.

Réglages communs : 0,75 balise / joueur, limites × 2, `probaCheckpoint=0.05`.

| Scénario | Meilleur /30 (10 / 30 / 80 j.) | SS du meilleur / SS en jeu (10 / 30 / 80) | Arène : tentatives / victoires / SS (30 j.) | Enchères SS vendues / ouvertes, prix (30 j.) |
|---|---|---|---|---|
| Sans arène ni enchère | 21 / 24 / 24 | 0 / 0 · 0,5 / 3,0 · 0,7 / 5,4 | — | — |
| Arène 5 % | 21 / 23 / 24 | 0,1 · 0,3 · 0,3 | 53 / 27 / 1,7 | — |
| Enchère de SS toutes les 30 min | 21 / 23 / 24 | 0,2 · 0,1 · 0,5 | — | 2,4 / 2,4 (71 J) |
| Arène 5 % + enchères / 30 min | 22 / 24 / 25 | 0,4 / 3,2 · 0,2 / 4,0 · 0,6 / 14,9 | 54 / 26 / 0,8 | 1,6 / 1,8 (56 J) |
| Arène 15 % + enchères / 15 min | 22 / 23 / 24 | 0,6 · 0,3 · 0,4 | 70 / 34 / 1,8 | 1,2 / 2,1 (51 J) |

Constats :
1. **Les SS ne manquent plus en jeu** : avec l'arène et les enchères, la limite de SS est vite atteinte (4 exemplaires à 10-30 joueurs, ≈ 15 à 80 joueurs). Les enchères ne trouvent alors plus de SS à vendre (seulement 2,1 ouvertes sur 10 prévues à 30 joueurs).
2. **Mais elles sont dispersées** : le meilleur joueur n'en a que 0,2 à 0,6. Il lui faut les 2, et elles sont chez d'autres joueurs, qui les gardent dans leur Livre.
3. **Le verrou n'est donc plus l'offre de SS, c'est leur circulation entre joueurs.** Le simulateur ne fait échanger ou vendre que des doublons ; il ne modélise pas un joueur qui cède une carte de son Livre (une SS) contre des jenny ou d'autres cartes, ni les vols ciblés. C'est pourtant ce qui se passera sur le terrain (négociation).
4. Pour 10 joueurs, beaucoup d'enchères restent invendues : peu de joueurs ont 50 J à ce moment (les jenny partent en paquets de sorts).

## Cession entre joueurs et taille du catalogue (2026-10-09, 10 graines)
Modèle de cession (`probaCession`, `prixCession`, `ecartCession`) : à chaque action, un joueur à qui manque une carte d'un rang cessible cherche un détenteur **distancé** (au moins `ecartCession` = 3 cartes désignées de retard sur lui) qui la lui cède contre le prix demandé, payé d'abord en doublons utiles au vendeur (revente × 2), le reste en jenny ; l'action y passe. Passe par `trade` du moteur (RG-11, délai entre deux échanges d'une même paire). Prix : SS 100, S 60, A 40, B 25, C 15, D 10 J. Catalogue réglable : `cat=SS1,S2,A3,B4,C5,D5` (N = somme). `multLimiteSS` : multiplicateur propre aux SS.

Réglages communs : 0,75 balise / joueur, limites × 2, checkpoints 5 %, arène 5 %, enchère de SS / 30 min.

| Scénario | Clear (10 / 30 / 80 j.) | Clear médian (min) | Meilleur /N |
|---|---|---|---|
| N = 30 (2 SS), cession SS seulement 5 % | 0 / 0 / 0 | — | 22 / 24 / 25 |
| N = 30 (2 SS), cession SS + S 5 % | 0 / 0 / 0 | — | 23 / 24 / 25 |
| N = 30, limite SS × 4 | 0 / 0 / 0 | — | 23 / 24 / 25 |
| N = 30 avec **4 SS** | 0 / 0 / 0 | — | 21 / 22 / 23 (plus dur) |
| N = 30 (2 SS), cession de tous les rangs 15 % | 0 / 0 / 0 | — | 24 / 24 / 26 |
| N = 30 avec **1 SS**, cession tous rangs 15 % | 0 / 0 / 0 | — | 24 / 26 / 26 |
| N = 24 (2 SS), cession tous rangs 15 % | 0 / 0 / 0 | — | 21 / 21 / 22 |
| N = 24 (1 SS), cession tous rangs 15 % | 0 / 0 / 1 | 147 | 21 / 22 / 23 |
| N = 20 (2 SS), cession SS + S 5 % | 0 / 0 / 0 | — | 18 / 16 / 18 |
| **N = 20 (1 SS), cession tous rangs 15 %** | **3 / 1 / 6** | **136 / 136 / 140** | 19 / 18 / 20 |
| N = 20 (1 SS), cession tous rangs 5 % | 1 / 1 / 0 | 148 / 121 / — | 18 / 18 / 19 |
| N = 20 (1 SS), sans cession | 0 / 0 / 0 | — | 18 / 17 / 17 |

Constats :
1. **Plus d'exemplaires de SS (limite × 4) ne change rien** : elles sont déjà en jeu, mais dispersées.
2. **Plus de cartes SS au catalogue rend le Clear plus dur** (il faut chacune) : 4 SS = −2 cartes pour le meilleur.
3. **La cession fait circuler les cartes** (jusqu'à plusieurs centaines par partie à 80 joueurs) mais ne suffit pas seule : à N = 30, il manque toujours ≈ 2 cartes au meilleur, surtout des SS, que les joueurs distancés n'ont pas.
4. **Des Clear apparaissent seulement avec N ≈ 20, une seule SS et des joueurs qui se cèdent des cartes** : 10 à 60 % des parties, vers 136-148 min, donc en fin de partie (pas de Clear prématuré). Sans cession, aucun.
5. **Le levier le plus fort est donc la composition du catalogue (N et nombre de SS)**, puis la négociation entre joueurs (que le jeu doit encourager). Le simulateur ne modélise ni la négociation volontaire entre deux joueurs proches du Clear, ni les vols ciblés : il sous-estime sans doute les Clear.

## Limites d'exemplaires (2026-10-09, 20 graines, 120 min, 1 SS, animation active)
Options du simulateur : `limiteSSUnPour` / `limiteSSMin` (SS en « 1 pour X joueurs, au moins Y »), `multLimiteCD` (C et D). N = 14 (16 au-delà de 50 joueurs). « Repli » = part des tirages de carte changés en jenny faute d'exemplaire disponible. **Variance** : d'une série de 20 graines à l'autre, le taux de Clear varie de ±20 points ; lire les tendances.

| Limites | Clear N = 14 (10 / 30 / 80 j.) | Clear N = 16 (80 j.) | Repli | SS en jeu à 80 j. |
|---|---|---|---|---|
| SS × 4, C/D × 2 (avant) | 40-60 % / 45 % / 85 % | 55 % | ≈ 48 % | ≈ 12 |
| **SS 1 pour 10, au moins 4**, C/D × 2 (retenu) | 40-65 % / 35-40 % / 65-80 % | 55 % | ≈ 48 % | ≈ 8 |
| SS 1 pour 10, C/D × 3 | 35 % / 15 % / 50 % | 30 % | ≈ 33 % | ≈ 8 |
| SS 1 pour 10, C/D × 4 | 10 % / 5 % / 45 % | 5 % | ≈ 20 % | ≈ 8 |

Constats :
1. Plafonner la SS à 1 exemplaire pour 10 joueurs (au moins 4) ne change rien jusqu'à 40 joueurs et divise par deux les SS en jeu dans les grands groupes, sans perte nette de Clear au N conseillé (16 au-delà de 50 joueurs).
2. **Relever les limites des cartes communes fait chuter les Clear** : moins de tirages changés en jenny, donc moins d'argent pour racheter des cartes, miser à l'arène, enchérir et acheter des sorts, et des Livres encombrés de doublons. Les jenny sont le carburant du jeu ; le « repli » d'environ une carte sur deux en jenny n'est pas une perte sèche (10 J par repli).
3. Regard n'est pas modélisé : la cession du simulateur suppose déjà que l'acheteur sait qui détient la carte ; Regard rend cette hypothèse réaliste.

## Cartes hors collection (2026-10-10, 40 graines, 120 min, 1 SS, animation active, SS 1 pour 10 au moins 4)
Options : `partReplisHC` (part des replis « carte épuisée » qui donnent une carte hors collection), `hcEnPlus` (la carte s'ajoute aux 10 J du repli au lieu de les remplacer), `poidsHC=pepite:3,ticket:3,boussole:2,souffle:2,voile:1,coffre:1`, `placesHC` (8). Modèle : Pépite revendue 30 J à Masadora ; Ticket gratté aussitôt (0 / 10 / 30 / 100 J, poids 40 / 35 / 20 / 5) ; Boussole = le scan suivant vise une balise active jamais scannée ; Second souffle = passe outre la boucle (RG-7.1) une fois ; Voile et Coffre gardés (1 de chaque, surplus revendu 10 J), effets défensifs non modélisés. Clear sur 40 parties.

| Scénario (N = 14 ; N = 16 pour la dernière colonne) | Clear 10 / 30 / 80 j. | Clear 80 j., N = 16 | Hors coll. / joueur |
|---|---|---|---|
| Sans | 17 / 16 / 28 | 22 | — |
| 1 repli sur 3 **remplacé** par une carte (les 6) | 14 / 10 / 25 | 21 | ≈ 2,8 |
| 1 repli sur 2 remplacé | 14 / 9 / 22 | 16 | — |
| 1 sur 3 remplacé, Pépite + Ticket seulement | 17 / 9 / 29 | 18 | — |
| 1 sur 3 remplacé, Boussole, Souffle, Voile, Coffre seulement | 16 / 8 / 18 | 12 | — |
| **1 repli sur 3 donne une carte en plus des 10 J** (les 6) | **17 / 14 / 38** | **30** | ≈ 2,5 (Boussole 0,4 utilisée, Souffle 0,2) |
| En plus, utilitaires seulement | 18 / 13 / 27 | 20 | ≈ 2,7 |

Constats :
1. **Remplacer les jenny coûte des Clear**, surtout avec les cartes sans valeur en jenny (Voile, Coffre) : c'est encore le carburant de l'économie.
2. **Donner la carte en plus des 10 J est neutre à favorable** (+10 à +25 points à 80 joueurs, grâce aux Pépites, Tickets et Boussoles). ≈ 2,5 cartes hors collection par joueur et par partie : assez pour exister, pas assez pour encombrer.
3. La Boussole et le Second souffle ont un effet mesurable mais modeste ; Voile et Coffre ne jouent que contre les sorts (non modélisés).

## Recommandations (validées le 2026-10-09, voir PROGRESS.md « Calibrage »)
- Limites en mode Multiplicateur × 2 par défaut (ou formules RG-14 revues pour ~20 exemplaires par joueur).
- Nombre de balises posées recommandé ≈ 0,75 × joueurs attendus (min 10).
- Chiffrer les sources de hauts rangs : checkpoints PNJ (combien, quels rangs, quelle fréquence), énigmes, enchères, arène de Soufrabi.
- Revoir l'accès aux SS : plus d'exemplaires (limiteSS ≥ 2), Apparitions plus fréquentes en fin de partie, ou SS obtenables via l'arène de Soufrabi / enchères à un rythme défini.
- Le Clear restera rare par conception : prévoir que la plupart des parties finissent au classement (RG-13.4).
