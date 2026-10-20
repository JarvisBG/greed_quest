# Tenue en charge sur les offres gratuites

Mesuré le 2026-10-20 avec le banc de charge : `pnpm --filter @gq/api charge [joueurs] [minutes]`
(`apps/api/src/charge/charge.ts`). Il joue une partie entière contre la vraie API (base PGlite en mémoire) et compte,
par type d'action, les requêtes à la base, les données relues (ce qui use le quota de Supabase), le calcul du serveur
et les messages temps réel. À relancer après tout gros changement du serveur.

## Hypothèses de jeu (par joueur)
Position toutes les 15 s (il marche), un scan toutes les 3 min, un sort toutes les 12 min, un passage à Masadora
toutes les 20 min ; les téléphones rechargent le Livre et les évènements à chaque message reçu ; un GM sur la carte,
un PNJ à l'Arène. C'est plutôt plus actif qu'une vraie partie.

## Limites gratuites (vérifiées le 2026-10-20)
- **Supabase (Free)** : base de 500 Mo ; **5 Go de trafic sortant par mois, compté pour toute l'organisation**
  (si Otaku Quest est dans la même organisation Supabase, les deux jeux se partagent ces 5 Go) ; mise en pause
  après 7 jours sans activité. Au-delà du trafic : avertissement, puis le projet peut être bloqué jusqu'au mois suivant.
- **Render (Free)** : 512 Mo de mémoire, 0,1 processeur, 750 h par mois, s'endort après 15 min sans visite.

## Résultats (partie de 120 min)

| Joueurs | Lu dans Supabase | Parties / mois (5 Go, marge 30 %) | Place en base | Requêtes base | Calcul serveur (PC) |
|---|---|---|---|---|---|
| 10 | 52 Mo | ≈ 70 | 5 Mo | 10 /s | 0,4 % d'un cœur |
| 30 | 162 Mo | ≈ 23 | 11 Mo | 25 /s | 1,1 % |
| 80 | 531 Mo | ≈ 7 | 27 Mo | 63 /s | 2,3 % |

**Avant l'optimisation du 2026-10-20** : 80 joueurs lisaient déjà 767 Mo dans les **30 premières minutes**
(et ça grossissait avec la partie) : une seule partie de 2 h à 80 joueurs aurait vidé le quota du mois.
Gain mesuré à 80 joueurs sur 30 min : 767 → 150 Mo ; à 30 joueurs sur 20 min : 95 → 25 Mo.

### Lecture
- **Supabase, trafic** : le point à surveiller. ≈ 7 grosses parties (80 joueurs) ou ≈ 23 parties de 30 par mois.
  Regarder chaque mois *Supabase → Usage → Egress*.
- **Supabase, place** : 500 Mo ≈ 18 parties de 80 joueurs (le journal des positions en fait les trois quarts).
  Au-delà, il faudra supprimer les vieilles parties de test ou alléger leur journal (pas encore d'outil dans la console).
- **Render, processeur** : le serveur réel ajoute le réseau (HTTP, chiffrement, Socket.IO) que le banc ne passe pas,
  et le 0,1 processeur de Render est plus lent que ce PC. Estimation prudente (× 3 réseau, × 1,5 machine) :
  30 joueurs ≈ la moitié du processeur gratuit ; **80 joueurs ≈ tout le processeur gratuit** (ça marche, mais les
  réponses ralentissent aux moments chargés). Au-delà de 80 joueurs, l'offre gratuite de Render est trop juste.
- **Render, mémoire** : le serveur seul tient bien sous 512 Mo ; Node est réglé pour libérer avant 320 Mo de tas
  (`NODE_OPTIONS` dans `render.yaml`).

## Ce qui a été corrigé (2026-10-20)
Plantages possibles :
- Connexion Supabase coupée au repos (maintenance du pooler) : erreur non écoutée → **tout le serveur tombait**.
  Écoutée maintenant ; pool limité à 8 connexions, requête coupée au bout de 20 s (ne bloque plus une partie).
- Promesse rejetée oubliée → le processus s'arrêtait : notée dans les journaux de Render, la partie continue.
- Statistiques d'une grosse partie (> ~100 000 lignes de journal) : `Math.max(...lignes)` faisait planter la page.

Lectures de la base allégées :
- Position (toutes les 15 s par joueur) : ne relit plus la fiche complète de tous les joueurs, seulement ceux
  qui sont dans un carré autour de lui, et 4 colonnes.
- Tâches (toutes les 5 s) : joueurs lus une fois par passage et sans la fiche entière ; Livres relus seulement pour
  les joueurs partis qui détiennent une SS ou une carte du Maître du jeu ; réserve de Matérialisation : seuls ces joueurs.
- Tirage : la base compte elle-même les exemplaires en circulation (une ligne par carte au lieu d'une par exemplaire).
- Paramètres : deux comptages en une requête ; Livre : pseudos seuls ; index `journal_action` (migration 0019).

Fronts :
- App joueur : une surenchère ou un coup de raid ne fait plus recharger le Livre de tous les joueurs ; seuls ceux
  qui sont dans la salle des enchères la relisent ; les annonces à tous sont relues dans les 3 s, à un moment tiré
  au hasard (pas toutes dans la même seconde).
- Console : l'Arène ne se recharge plus à chaque ligne du journal (scans, positions…), seulement aux lignes de l'Arène.

## Côté téléphone (mesuré le 2026-10-20)
Edge piloté (CDP), écran 390 × 844, processeur ralenti 6× (téléphone d'entrée de gamme), partie en cours avec 29 bots.
- **Premier lancement** : 405 Ko à télécharger (code 272 Ko compressé, styles 50 Ko, polices) ; ≈ 5-7 s en 3G avant
  le premier affichage ; l'exécution du code ne prend que 0,16 s (0,28 s à 6×). Les lancements suivants partent du cache.
  Ensuite, l'app met en cache les illustrations des cartes (≈ 3,2 Mo) en arrière-plan : à savoir pour les forfaits data.
- **Accueil en jeu** : l'onde « Tu es ici » de la petite carte tournait sans fin dans le SVG de l'île (filtres de
  turbulence) et le faisait redessiner 60 fois par seconde : 487 ms de travail par seconde et 31 saccades en 30 s.
  Elle fait maintenant 3 pulsations à chaque nouvelle position puis s'arrête : 153 ms/s, 2 saccades.
- Book, Sorts, Échanges : 118 à 143 ms/s, aucune saccade. Masadora 341 ms/s et Antokiba 239 ms/s (décors animés,
  aucune saccade) : laissés tels quels.

## Consignes pour le jour de la partie
1. **Ne rien pousser sur `refonte-joueur` pendant une partie** : Render redéploie à chaque push et redémarre le
   serveur (≈ 1 min de coupure, les téléphones se reconnectent seuls, les scans hors ligne sont rejoués).
2. Ouvrir la console 5 min avant (Render se réveille en ≈ 1 min).
3. Si Supabase est en pause (7 jours sans partie) : supabase.com → projet → **Restore**, la veille.
4. Vérifier *Supabase → Usage* avant une grosse partie, surtout si Otaku Quest partage l'organisation.
5. Plus de 80 joueurs : prévoir une offre payante pour Render (processeur), ou deux parties plus petites.
