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

## Recommandations (validées le 2026-10-09, voir PROGRESS.md « Calibrage »)
- Limites en mode Multiplicateur × 2 par défaut (ou formules RG-14 revues pour ~20 exemplaires par joueur).
- Nombre de balises posées recommandé ≈ 0,75 × joueurs attendus (min 10).
- Chiffrer les sources de hauts rangs : checkpoints PNJ (combien, quels rangs, quelle fréquence), énigmes, enchères, arène de Soufrabi.
- Revoir l'accès aux SS : plus d'exemplaires (limiteSS ≥ 2), Apparitions plus fréquentes en fin de partie, ou SS obtenables via l'arène de Soufrabi / enchères à un rythme défini.
- Le Clear restera rare par conception : prévoir que la plupart des parties finissent au classement (RG-13.4).
