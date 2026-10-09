# Plan des tâches

Cocher ici au fil de l'eau ; l'état synthétique et les décisions vont dans `PROGRESS.md`.
Chaque tâche = un commit (ou quelques-uns), tests verts avant de cocher.

## Phase 1 — Moteur de règles (`packages/engine`, pur, sans I/O)
- [x] 1.1 Types de domaine partagés (`@gq/shared`) : rangs, types de balise, sorts, Nen, états de partie, statuts
- [x] 1.2 RNG injectable + seedé (tests déterministes, simulation)
- [x] 1.3 Paramètres dynamiques : formules auto RG-14, résolution Auto / Verrouillé / Multiplicateur RG-14.2, vue console RG-14.6
- [x] 1.4 Lissage de J RG-14.1 (hausse immédiate, baisse limitée)
- [x] 1.5 Tirage RG-8.3 : nature, rang (type de balise, rendement décroissant RG-7.2), carte dispo sous limite RG-8.2, repli rang inférieur / jenny
- [x] 1.6 Livre RG-8.5 : emplacements désignés + 15 libres, pages de 10, Livre plein
- [x] 1.7 Vérifications de scan RG-7 dans l'ordre (partie, joueur, balise, boucle RG-7.1, délai RG-7.3, Livre, stock) + motifs en clair RG-7.4
- [x] 1.8 Balises : cycle d'états RG-6.3, choix des balises à activer, rotation RG-6.4
- [x] 1.9 Géoloc : distance haversine, portée RG-10.11, hors radar RG-10.10, vitesse anti-triche RG-15
- [x] 1.10 Sorts RG-10 : ciblage, immunité, délai lanceur, protections (Barrière → Renforcement), Vol, Échange forcé, Gel, Radar, Révélation, Duplication, Analyse
- [x] 1.11 Contrefaçons RG-8.6 → 8.9 : création, visibilité par joueur, révélation
- [x] 1.12 Échanges RG-11.1 → 11.3 : validation, contrepartie, fréquence par paire, application atomique ; enchères RG-11.4 / 11.5
- [x] 1.13 Boutique RG-9 : paquets, stock par vague, revente (roulette RG-9.5 reportée : lots non définis)
- [x] 1.14 Classement RG-13.5 / 13.7 (live vs final) et détection du Clear RG-13.1
- [x] 1.15 Cycle de vie de partie RG-4 (transitions autorisées, horloge suspendue en pause)
- [x] 1.16 Événements GM RG-12 (effets sur scan/tirage/boutique, un seul par zone) + retour en jeu des SS RG-8.12
- [ ] 1.17 Simulateur de partie (10 / 30 / 80 joueurs) pour le calibrage

## Phase 2 — API (`apps/api`)
- [ ] 2.0 Préréglages RG-14.5 (stockés en base ; contenu Petit groupe / Grande foule à définir)
- [ ] 2.1 Fastify + config + PGlite/Drizzle, schéma des 11 entités, migrations, seed (catalogue 30 cartes, zones, balises)
- [ ] 2.2 Journal RG-3.1 (transactionnel, motif obligatoire PNJ/GM)
- [ ] 2.3 Auth : joueur (appareil), PNJ, GM ; rôles RG-3
- [ ] 2.4 Inscription RG-5 : pseudo, appareil unique, Examen Hunter, test de Nen, kit, retardataire
- [ ] 2.5 Licence QR tournante 30 s (jeton signé) RG-5.2
- [ ] 2.6 Endpoints d'intentions : scan, position, sort, achat, revente, session d'échange (cartes engagées verrouillées, 1 session active par joueur), enchère
- [ ] 2.7 Socket.IO : rooms joueur / staff / tracker, matrice de diffusion (REGLES.md « Diffusion »)
- [ ] 2.8 Tâches planifiées : J (2 min), rotation (20 min), recharge, vagues boutique, fin d'événements (fantôme, carte maudite, raid), inactivité et retour des SS RG-8.12, agenda d'événements RG-12.3
- [ ] 2.9 Endpoints GM/PNJ : cycle de vie, paramètres, balises, événements, corrections, sanctions, checkpoints, enchères, Clear
- [ ] 2.10 Alertes anti-triche RG-15
- [ ] 2.11 Tests d'intégration bout en bout (partie simulée)

## Phase 3 — App joueur (`apps/player`, PWA)
- [ ] 3.1 Squelette Vite + React + PWA, client Socket.IO
- [ ] 3.2 Inscription, Examen, test de Nen
- [ ] 3.3 Scan QR caméra + envoi position ; file hors ligne RG-7.5
- [ ] 3.4 Livre (pages, provenance, pertes), licence QR
- [ ] 3.5 Sorts (liste à portée), alertes reçues
- [ ] 3.6 Échanges (liste à portée, proposition, double validation), boutique, enchères, raid

## Phase 4 — Console PNJ / GM (`apps/staff`)
- [ ] 4.1 Console PNJ : scan licence, checkpoint, photo-preuve, enchère, avertir/geler
- [ ] 4.2 Console GM : cycle de vie, paramètres (J, auto, mode, appliqué), balises, carte des positions, événements, journal, alertes, Clear

## Phase 5 — Écran géant (`apps/tracker`)
- [ ] 5.1 Fil d'actualité, classement live, balises par zone, heatmap décalée, bannières d'événements, raid, Clear plein écran

## Phase 6 — Terrain
- [ ] 6.1 Déploiement (hébergement api + PostgreSQL)
- [ ] 6.2 Impression des balises, partie test, calibrage portée GPS et paramètres
