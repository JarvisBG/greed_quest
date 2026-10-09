# Simulation de calibrage

Commande : `pnpm --filter @gq/engine sim [graines] [option=valeur …]` (ex. `sim 20 balisesPosees=15 probaEchange=0.5`).
Code : `packages/engine/src/sim/`. Toutes les règles viennent du vrai moteur.

## Modèle (v1, 2026-10-09)
- Chaque joueur marche 1 à 3 min vers une balise **au hasard** parmi les balises posées (il ne sait pas lesquelles sont actives, RG-6.5) et scanne.
- Livre presque plein → aller-retour à Masadora pour revendre ses doublons (hors SS).
- À chaque action, 20 % de chances de tenter un échange 1 contre 1 avec un joueur au hasard : un doublon qui lui manque contre un doublon qui me manque.
- Le GM lance une Apparition toutes les 15 min (seule source de SS).
- Tous les joueurs restent actifs (J = nombre de joueurs). Paramètres RG-14 par défaut. Partie de 150 min.
- **Non modélisé** : sorts (Vol, Échange forcé…), achat de cartes contre des jenny entre joueurs, enchères, checkpoints PNJ, énigmes (sources de B, A, S), contrefaçons, autres événements.

## Résultats (20 parties par taille)

40 balises posées (réglages par défaut) :

| Joueurs | Clear | Meilleur (médiane /30) | Moyenne /30 | Tirages / joueur | Repli jenny | Scans refusés |
|---|---|---|---|---|---|---|
| 10 | 0/20 | 10 | 7,0 | 8,7 | 0 % | dormante 83 % |
| 30 | 0/20 | 15 | 9,8 | 16,0 | 23 % | dormante 68 % |
| 80 | 0/20 | 15 | 10,2 | 45,0 | 72 % | épuisée 24 % |

15 balises posées : 10 joueurs → meilleur 14/30, 21,5 tirages/joueur ; 30 et 80 joueurs → toujours 14-15/30.
15 balises + échanges fréquents (50 %) + Apparition toutes les 10 min : aucun changement notable (meilleur 15/30).

## Constats
1. **Personne ne fait le Clear en 150 min**, quels que soient le nombre de joueurs et les réglages testés.
2. **Cause structurelle : les limites d'exemplaires (RG-14).** Le total d'exemplaires autorisés en jeu vaut environ **10 à 12 par joueur** (117 pour 10 joueurs, 311 pour 30, 834 pour 80), alors qu'un Clear en demande 30. Le Clear n'est possible que si un joueur concentre les cartes des autres (vol, échange, achat) — ce que la v1 du simulateur ne modélise presque pas.
3. **Une seule copie de chaque SS en dessous de 40 joueurs** (`limiteSS = max(1, floor(J/20))`) : le gagnant doit obtenir les deux seuls exemplaires existants.
4. **Petits groupes : trop de balises posées.** À 10 joueurs, 5 balises actives sur 40 : 83 % des scans tombent sur une balise dormante, soit environ 9 tirages par joueur en 150 min. Le nombre de balises posées doit suivre la taille du groupe (≈ 1,5 × J semble mieux).
5. **Grands groupes : le stock s'épuise.** À 80 joueurs, 72 % des tirages « carte » deviennent des jenny : toutes les cartes du rang tiré et en dessous sont à leur limite.

## Pistes (à décider)
- Relever les limites (mode Multiplicateur RG-14.2, ex. × 2 à × 3) ou revoir les formules pour viser ~20 à 30 exemplaires par joueur.
- Réduire N (cartes désignées, paramètre `cartesDesignees`) pour les parties courtes ou les petits groupes.
- Garder la rareté voulue par le document, mais modéliser Vol et achats entre joueurs dans le simulateur (v2) avant de conclure.
- Recommander un nombre de balises posées selon le nombre de joueurs attendu.
