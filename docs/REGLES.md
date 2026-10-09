# Greed Quest — Règles de gestion (version condensée)

Source de vérité : `Greed Quest - Règles de gestion.docx` (9 oct. 2026, Sivraj · loJIC Solutions).
Ce fichier en est le résumé fidèle pour le code. **Une règle absente n'est pas codée.** Citer `RG-x.y` dans le code et les tests.
Si le .docx change, mettre ce fichier à jour.

## Principes
- **P1 Serveur autoritaire** : tirages, stocks, sorts, scores calculés serveur. Le client n'envoie que des intentions.
- **P2** 1 téléphone = 1 joueur = 1 Livre. Solo ; alliances informelles via échanges.
- **P3** Paramètres auto selon J (joueurs actifs), surchargeables par le GM.
- **P4** Toute obtention de carte exige déplacement/interaction physique.
- **P5** Tout est journalisé et diffusé en temps réel.

## Entités (→ tables)
Partie (état, horaires, paramètres, zone) · Joueur (pseudo, licence QR dynamique, type de Nen, jenny, dernière position, statut) · Livre (emplacements désignés + libres) · Carte/modèle (numéro, nom, rang, désignée, lot réel) · Exemplaire (carte, propriétaire, origine, date) · Sort (type, propriétaire, utilisé) · Balise (id, zone, type, état, stock) · Zone (Masadora, Antokiba, Soufrabi, zones sauvages ; type) · Checkpoint PNJ (arbitre, zone, défi, cartes) · Événement (type, cible, début, fin) · Journal (horodatage, acteur, action, résultat).
**Joueur actif** = au moins une action dans les 15 dernières min. **Jenny (J)** = monnaie.

## RG-3 Rôles
| Espace | Acteur | Peut | Ne peut pas |
|---|---|---|---|
| Candidat | Joueur | scanner, sorts, échanger, acheter, voir son Livre et la carte | voir stocks/positions/Livres d'autrui (sauf sort) |
| Arbitres | PNJ | scanner licence, donner cartes du checkpoint, valider photo-preuve, mener enchère, avertir, geler 5 min | modifier paramètre, disqualifier |
| Game Master | GM | tout PNJ + démarrer/pause/terminer, régler/verrouiller paramètres, activer/couper balise, lancer événement, corriger Livre, voir positions exactes, disqualifier | agir sans trace |
| Live Tracker | Écran géant | afficher infos publiques | toute écriture |
- RG-3.1 Action PNJ/GM journalisée avec auteur ; motif obligatoire pour correction/sanction.
- RG-3.2 Plusieurs GM possibles, même poids, distingués au journal.

## RG-4 Cycle de vie : Brouillon → Inscriptions → En cours ⇄ Pause → Phase finale → Terminée
Seul le GM avance l'état, sauf passage auto en phase finale et fin du temps. Un Clear confirmé termine depuis En cours ou Phase finale.
- 4.1 Brouillon : GM prépare catalogue/balises/zones/params ; aucun joueur.
- 4.2 Inscriptions : inscription + Examen ; aucun scan.
- 4.3 En cours : inscriptions ouvertes jusqu'à fermeture GM.
- 4.4 Pause : scans/sorts/échanges/achats refusés ; compteurs (événements, gels, immunités) suspendus puis reprennent.
- 4.5 Phase finale : 30 min avant la fin ou décision GM ; inscriptions fermées d'office.
- 4.6 Terminée : plus d'action, classement figé, journal archivé.

## RG-5 Joueurs
- 5.1 Pseudo unique par partie ; 1 appareil = 1 joueur par partie ; géoloc obligatoire.
- 5.2 Licence = QR dans l'app renouvelé toutes les 30 s ; sert aux interactions consenties (échange, checkpoint, enchère, Clear). Pas de badge. *(Plus utilisée pour les échanges depuis l'amendement RG-11.1.)*
- 5.3 Examen Hunter : quiz 3 questions, non bloquant ; bonne réponse = bonus jenny.
- 5.4 Test de Nen : 5 questions → 1 des 6 types. Spécialisation rare (5 % réglable).
- 5.5 Kit : jenny + 1 sort aléatoire commun.
- 5.6 Retardataire : kit + bonus de rattrapage proportionnel au temps écoulé (désactivable).
- 5.7 Statuts : actif · inactif (15 min, exclu de J) · gelé · disqualifié · abandon.

| Nen | Passif |
|---|---|
| Renforcement | Annule le 1er sort offensif reçu (1×/partie) |
| Émission | 1 sort offensif hors portée (1×/partie) |
| Transformation | Texture Surprise : déguise 1 doublon en carte de même rang → contrefaçon (toutes les 20 min). *Amendement 2026-10-09 : un doublon S peut aussi imiter la SS (unique au catalogue), pour le bluff.* |
| Matérialisation | +1 tirage bonus ≤ rang C à chaque checkpoint PNJ réussi |
| Manipulation | 1 échange forcé gratuit (1×/partie) |
| Spécialisation | Pouvoir unique secret tiré au sort (liste à définir) |

## RG-6 Balises
- 6.1 Id unique non devinable ; QR imprimé fixe, seul l'état serveur change.
- 6.2 Stock attribué à l'activation selon J ; chaque tirage réussi décrémente.
- 6.3 Stock 0 → épuisée → dormante après recharge (15 min). Le moteur active aussitôt une dormante d'une autre zone pour garder la cible.
- 6.4 Rotation toutes les 20 min : 30 % des actives remplacées, priorité aux zones moins visitées. GM peut forcer.
- 6.5 Joueur ne voit jamais l'emplacement ; écran géant = nb actives par zone.

États → réponse au scan : Dormante « Cette balise dort » · Active → tirage · Épuisée « Plus rien ici, cherche ailleurs » · Coupée (GM) refus sans motif.
Types : **Standard** rangs D–A, stock normal, rotation auto · **Rare** C–S poids relevés, stock ½, peu nombreuses · **Fantôme** S/SS, stock 1–2, seulement pendant événement GM.
> **Amendement 2026-10-09 (Sivraj)** : toutes les balises imprimées sont identiques. Le type n'est pas attaché à une balise : le serveur le tire à chaque activation (rare avec la probabilité `partRaresPct`, 15 % par défaut, réglable RG-14). Le mode fantôme s'applique à n'importe quelle balise dormante pendant une Apparition.

## RG-7 Scan (vérifs dans l'ordre, arrêt au 1er échec)
1. Partie en cours (ni pause ni terminée). 2. Joueur actif, non gelé, GPS valide. 3. Balise active, zone non fermée par événement. 4. Boucle (7.1). 5. Délai (7.3). 6. Place dans le Livre (8.5). 7. Stock > 0. → tirage.
- 7.1 Boucle : après un tirage sur une balise, réussir des tirages sur K autres balises distinctes (K=3) avant d'y retirer.
- 7.2 Rendement décroissant : 2e tirage même joueur/même balise plafonné rang B ; 3e+ plafonné rang D.
- 7.3 30 s min entre deux scans d'un joueur.
- 7.4 Refus gratuit, motif en clair (ex. « Boucle : scanne encore 2 balises différentes »), journalisé.
- 7.5 Hors ligne : scan mis en file avec son heure, traité au retour s'il a < 10 min, contre l'état serveur à la réception.
- 7.6 Sans GPS valide : ni scan, ni achat, ni sort.

## RG-8 Cartes
- 8.1 N cartes désignées (30), numérotées 001..N, liables à un lot réel.
> **Amendement 2026-10-09 (Sivraj) — N réglable, 1 SS, Clear possible** : le GM compose le catalogue avant le démarrage (`PUT /catalogue`, 7 à 60 cartes, toutes désignées) ; N le suit et se fige au démarrage (démarrage refusé si le catalogue ne compte pas N cartes). **Une seule SS** au catalogue ; les autres rangs au prorata du tableau ci-dessous (`repartitionCatalogue`). **Conseil de N pour qu'un Clear soit possible en fin de partie** (`conseilCartesDesignees`) : 12 cartes à 90 min, +2 par demi-heure (14 à 120 min, 16 à 150 min, 18 à 180 min), +2 au-delà de 50 joueurs. Simulation : à 120 min avec N = 14, Clear dans ≈ 50 % (10 joueurs), 45 % (30), 80-85 % (80) des parties, vers 91-104 min, avec une animation active (≈ 2,5 cartes de checkpoint par joueur, cessions entre joueurs).
- 8.2 Limite d'exemplaires en circulation par carte (rang + J). À la limite → hors table de tirage. Limite absolue.
- 8.3 Tirage : nature (carte 82 %, sort 13 %, jenny 5 %) → rang selon poids (ajusté type balise + rendement décroissant) → carte au hasard dispo de ce rang. Rang épuisé → rang inférieur ; tout épuisé → jenny.
- 8.4 Doublons autorisés.
- 8.5 Livre : 1 emplacement par carte désignée + 15 libres (doublons, sorts), pages de 10. Plein → gain refusé, balise non décrémentée.

| Rang | Nb cartes | Poids standard | Sources |
|---|---|---|---|
| SS | 2 (amendement : 1) | 0 % | fantômes, arène Soufrabi, enchères |
| S | 3 | 1 % | rares, PNJ |
| A | 5 | 4 % | rares, PNJ, enchères |
| B | 6 | 12 % | énigmes terrain, PNJ |
| C | 7 | 25 % | standard |
| D | 7 | 40 % | standard |
(Poids sur l'ensemble des tirages, total 82 %.)

**Contrefaçons**
- 8.6 Occupe un emplacement (même désigné), s'échange/se vole/se revend. Ne compte ni pour le Clear ni dans la limite de la carte imitée. Un doublon déguisé reste compté dans la limite de sa vraie carte.
- 8.7 Origine : Duplication sur carte à sa limite, ou Transformation. Le créateur la voit marquée ; la marque disparaît au changement de main.
- 8.8 Démasquer (sur son propre Livre) : sort Analyse (1 page) ou expertise PNJ Antokiba (10 J/page, 25 J/Livre). Démasquée = reste marquée pour son détenteur ; provenance montre le donneur.
- 8.9 Après révélation : doublon déguisé → redevient sa vraie carte. Copie Duplication → « Contrefaçon de [nom] » grisée, libère l'emplacement désigné ; revente 1 J à Masadora ou refilable (marque disparaît au changement de main). Masadora révèle toute contrefaçon vendue. Affichage dépend de ce que chaque joueur sait.

**SS** : 8.10 se volent/s'échangent. 8.11 Immunité au vol 10 min après obtention. 8.12 SS d'un joueur inactif 20 min / abandon / disqualifié → retour via Apparition.
**Historique** : 8.13 Carte perdue ne compte plus ; emplacement désigné vide affiche « Volée par X à 14h05 ». 8.14 Fiche de provenance par carte.

## RG-9 Jenny & Masadora
- 9.1 Sources : kit, tirages, checkpoints, revente, événements.
- 9.2 Paquets de 3 sorts aléatoires ; scan du QR boutique sur place.
- 9.3 Stock de paquets par vague de 20 min (selon J) ; max 2 paquets/joueur/vague.
- 9.4 Revente de toute carte sauf SS ; l'exemplaire sort du jeu et libère la limite.
- 9.5 Roulette activable par le GM (coût jenny/tour).
Prix défaut (réglables) : paquet 50 J · revente D/C/B 5/10/20 J · A/S 40/80 J · SS interdite.

## RG-10 Sorts
| Sort | Effet | Ciblage |
|---|---|---|
| Vol | Prend 1 exemplaire au hasard | joueur à portée |
| Échange forcé | Donne 1 carte choisie, reçoit 1 au hasard | joueur à portée |
| Gel | Cible ne peut plus scanner 3 min | joueur à portée |
| Barrière | Annule le prochain sort offensif reçu | passif |
| Radar | Zone de la dernière position d'un joueur | liste joueurs |
| Révélation | Zone d'une balise rare active | aucun |
| Duplication | Copie une carte : vraie si sous limite, sinon contrefaçon | carte de son Livre |
| Analyse | Révèle les contrefaçons d'une page | page de son Livre |
- 10.1 Vol/Échange forcé/Gel : cible dans la liste « à portée » calculée serveur. Émission : 1× hors portée.
- 10.2 Cible touchée → immunisée aux offensifs 5 min.
- 10.3 2 min min entre deux offensifs d'un lanceur.
- 10.4 Protections : Barrière puis Renforcement ; consommée = perdue.
- 10.5 Alerte immédiate à la cible (lanceur, sort, résultat).
- 10.6 Tout sort affiché sur l'écran géant (lanceur, cible, résultat).
- 10.7 Duplication : sous limite → vrai exemplaire compté ; à la limite → contrefaçon.
- 10.8 Analyse : sa propre page, jamais un échange en cours ; résultat privé.
**Géoloc** : 10.9 envoi toutes les 15 s si déplacement > 10 m, + à chaque scan/achat/sort. 10.10 Position > 2 min → hors radar (ni viser ni être visé). 10.11 Portée 30 m (réglable) + marge GPS plafonnée 20 m. 10.12 Positions exactes : serveur + GM seulement ; écran = points anonymes/heatmap, décalage 2 min ; joueur ne reçoit jamais la position d'autrui (sauf zone via Radar).
> **Amendement 2026-10-09 (Sivraj)** — RG-10.10 : un joueur sans nouvelle position (GPS coupé, téléphone en veille, app quittée) reste **ciblable à sa dernière position connue pendant 10 min** (paramètre `ciblableMin`, réglable), au lieu de sortir du radar après 2 min. Au-delà, il est hors radar et l'équipe reçoit une alerte (`sans_position`, une par disparition). Pour agir lui-même (scan, achat, sort, échange), une position de moins de 2 min reste exigée (RG-7.6). But : qu'on ne puisse pas se cacher en coupant le GPS pour protéger son Livre.

## RG-11 Échanges & enchères
- 11.1 A compose l'offre (cartes, jenny) ; B scanne la licence de A puis accepte sous 60 s. Atomique.
> **Amendement 2026-10-09 (Sivraj)** — échange « à la Pokémon », sans scan de licence : A choisit B dans la liste des joueurs **à portée** (même rayon que les sorts) et propose ; B reçoit une notification et accepte ou refuse (60 s) ; chacun compose sa part (cartes et/ou jenny) en voyant celle de l'autre ; l'échange n'a lieu que si **les deux valident**. Toute modification d'une part annule les deux validations. Session expirée après 3 min sans action ; chacun peut annuler. RG-11.2, 11.3 et 11.6 inchangées.
- 11.2 Chaque côté donne ≥ 1 carte ou 1 jenny. Don pur refusé.
- 11.3 Une même paire : 1 échange / 10 min.
- 11.4 Enchères Antokiba : PNJ met une carte en vente 3 min ; scan QR enchère sur place puis surenchère dans l'app ; seul le gagnant est débité.
- 11.5 Sans offre → retour au stock du PNJ.
> **Amendement 2026-10-09 (Sivraj, calibrage)** : le PNJ d'Antokiba peut mettre **librement** une SS aux enchères, dans la limite d'exemplaires (RG-8.2).
> **Amendement 2026-10-09 (Sivraj) — Arène de Soufrabi** : un PNJ tient l'arène. Il scanne la licence du joueur, qui paie une **mise** (`areneMiseJ`, 30 J). Le PNJ arbitre un défi physique ou d'adresse. **Victoire** : tirage d'une carte A / S / SS (50 / 40 / 10 %, rang épuisé → rang inférieur, limites RG-8.2). **Défaite** : mise perdue. Une tentative par joueur toutes les `areneDelaiMin` (15 min, depuis l'entrée), une à la fois ; Livre plein : la carte gagnée déborde, comme pour un checkpoint. Entrée par erreur : le PNJ annule (motif), mise remboursée. Victoire en S ou SS annoncée sur l'écran.
- 11.6 Carte reçue apparaît toujours vraie ; pas de vérification avant acceptation.

## RG-12 Événements GM
| Événement | Effet | Durée | Annonce |
|---|---|---|---|
| Apparition | Balise fantôme dans une zone (1–2 tirages S/SS) | 10 min | écran + push, zone seulement |
| Double gain | Tirages d'une zone = 2 gains | 10 min | écran + push |
| Zone maudite | Zone fermée, scans refusés | 10 min | écran + push |
| Raid de la Brigade | Boss collectif, bonnes réponses retirent des PV ; victoire → paquet de sorts aux participants | 10 min | écran (barre de vie) + push |
| Krach de Masadora | Boutique à -50 % | 15 min | écran + push |
| Carte maudite | Carte piégée chez un joueur au hasard, circule ; porteur à l'échéance perd 2 cartes au hasard (hors SS) | 10 min | « une carte maudite circule » |
| Mission secrète | Objectif à un joueur, validé par PNJ | réglable | aucune |
- 12.1 Un seul événement de zone à la fois par zone ; globaux cumulables.
- 12.2 GM peut annuler ; gains obtenus conservés.
- 12.3 Agenda auto proposant des événements, confirmé par le GM ; désactivé par défaut.

## RG-13 Victoire & classement
- 13.1 Clear provisoire : Livre complet → Livre gelé (insensible aux sorts), joueur doit voir le GM. Contrefaçon présente → refus, en indiquant la page mais pas la carte.
- 13.2 Clear confirmé : GM scanne la licence → partie terminée, classement figé.
- 13.3 Le gagnant choisit 3 cartes = lots réels.
- 13.4 Fin sans Clear à l'heure de fin.
- 13.5 Classement : (1) nb cartes désignées distinctes, (2) somme des rangs SS6 S5 A4 B3 C2 D1, (3) jenny, (4) heure de la dernière carte désignée (plus tôt gagne).
- 13.6 Podium top 3 : lots organisateur, en plus du Clear.
- 13.7 Live : compte les contrefaçons (rien ne trahit) ; final et Clear : vraies seulement.

## RG-14 Paramètres dynamiques
> **Conseils d'organisation (calibrage validé le 2026-10-09, non bloquants)** : ≈ 0,75 balise posée par joueur attendu (min 10) ; 1 checkpoint PNJ pour 10 joueurs, ≈ 2,5 cartes de checkpoint par joueur attendu (objectif « Clear possible », décision du 2026-10-09), stock B / A / S en 50 / 35 / 15 % (moteur `conseils.ts`) ; taille du catalogue : voir l'amendement RG-8.1.
- 14.1 J recalculé toutes les 2 min ; hausse immédiate, baisse max un palier / 10 min.
- 14.2 Modes : Auto · Verrouillé · Multiplicateur (formule × coef).
- 14.3 Pas de rétroactivité.
- 14.4 Limite qui baisse sous le nb en circulation : rien retiré, la carte sort juste de la table.
- 14.5 Préréglages (Petit groupe, Standard, Grande foule) + enregistrement de nouveaux.
- 14.6 Console : J, valeur auto, mode, valeur appliquée.

> **Amendement 2026-10-09 (Sivraj, calibrage)** : les limites d'exemplaires (S, A, B, C/D) sont en mode **Multiplicateur × 2** par défaut, la SS (unique) en **× 4** (≥ 4 exemplaires). Les formules du tableau restent la valeur « auto ». **Durée par défaut : 120 min** (150 dans le document).

| Paramètre | Formule auto | Mode défaut |
|---|---|---|
| Balises actives | ceil(J/3), borné [5, nb posées] | Auto |
| Stock balise | ceil(J/2), borné [5, 30] | Auto |
| Limite SS | max(1, floor(J/20)) | Multiplicateur × 4 |
| Limite S | max(2, ceil(J/10)) | Multiplicateur × 2 |
| Limite A | max(3, ceil(J/5)) | Multiplicateur × 2 |
| Limite B | max(4, ceil(J/3)) | Multiplicateur × 2 |
| Limite C/D | max(5, ceil(J/2)) | Multiplicateur × 2 |
| Paquets par vague | ceil(J/2) | Auto |
| PV boss | J × 10 | Auto |
| K boucle | 3, ou 2 si < 8 balises actives | Auto |
| Durée partie | 150 min (amendement : 120) | Verrouillé |
| Mise de l'arène (amendement) | 30 J | Auto |
| Délai entre deux tentatives à l'arène (amendement) | 15 min | Auto |
| N cartes désignées | 30 | Verrouillé |

## RG-15 Anti-triche (le moteur alerte, ne sanctionne jamais seul)
Alertes : même balise scannée par 2 joueurs à < 10 s et > 200 m d'écart · vitesse > 15 km/h · 2e inscription d'un appareil (bloquée) · échanges répétés déséquilibrés · rythme de scan anormal.
Sanctions : photo de balise → gains annulés + gel 5 min (PNJ/GM) · faux GPS → disqualif (GM) · sortie de zone → avertissement (PNJ/GM) · balise déplacée/abîmée → disqualif (GM) · multi-comptes → disqualif de tous (GM).
- 15.1 Sanction journalisée et notifiée avec motif.
- 15.2 Disqualifié : perd son Livre, cartes retournent au stock.

## Diffusion temps réel
| Action | Joueur concerné | Tous joueurs | PNJ/GM | Écran géant |
|---|---|---|---|---|
| Tirage réussi | détail | non | journal | fil si rang ≥ A ; progression |
| Scan refusé | motif | non | journal, alerte si suspect | non |
| Sort lancé | lanceur + cible | non | journal | fil |
| Échange conclu | les deux | non | journal | fil si S/SS |
| Position | non | non | exacte (GM) | anonyme/heatmap, -2 min |
| Balise activée/épuisée | non | non | carte des balises | nb actives/zone |
| Événement | selon | push | console | bannière + compte à rebours |
| Raid | questions | push | PV restants | barre de vie |
| Sanction | motif | non | journal | non |
| Clear | confirmation/refus | push si confirmé | demande de validation | plein écran |

## Points ouverts (à trancher)
- Nom définitif / habillage (HxH fans vs original clients).
- Le Clear termine-t-il la partie ou ouvre-t-il une phase finale pour le podium ?
- Compte joueur persistant entre parties ou par partie ?
- Pouvoirs de Spécialisation, contenu Examen Hunter et test de Nen.
- Portée 30 m à valider sur le terrain.
- Calibrage par simulation : temps moyen d'un Clear à 10, 30, 80 joueurs.
