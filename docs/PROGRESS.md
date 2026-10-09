# Progression

## État actuel
**Phase 0 — Cadrage** (9 oct. 2026)
- [x] Lecture du document de règles, résumé dans `docs/REGLES.md`
- [x] `CLAUDE.md` créé
- [x] Stack validée (CLAUDE.md)
- [x] Environnement vérifié : Node 24.21, npm 11.19, git 2.55, corepack 0.36. **Absents** : pnpm, PostgreSQL, Docker.
- [x] pnpm 10.34 installé via `npm i -g pnpm` (corepack exige les droits admin : EPERM)
- [x] `git init` (branche `main`) + monorepo : `packages/engine`, `packages/shared` ; TS 7, Vitest 5, Zod 4 ; `pnpm typecheck` et `pnpm test` OK

- [x] Premier commit, poussé sur https://github.com/JarvisBG/greed_quest (branche `main`, auteur git local « Sivraj »)
- [x] Plan détaillé des tâches : `docs/PLAN.md`

**Phase 1 — Moteur** (terminée) : tâches 1.1 → 1.17 faites (types, RNG, paramètres RG-14, lissage J, tirage RG-8.3, Livre RG-8.5/8.13/8.14, scan RG-7, balises RG-6, géoloc RG-10.9→10.11 + RG-15, sorts RG-10, contrefaçons RG-8.6→8.9, échanges et enchères RG-11, boutique RG-9, classement et Clear RG-13, cycle de vie RG-4, événements RG-12, simulateur). 203 tests verts.

**Simulation v2** (`docs/SIMULATION.md`, avec sorts, boutique, achats entre joueurs, checkpoints PNJ optionnels) : aucun Clear en 150 min dans aucun scénario. Leviers mesurés : limites × 2, ≈ 0,75 balise posée par joueur, sources de hauts rangs à chiffrer ; les SS restent le verrou final. Décision de calibrage en attente.

**Phase 2 — API** (en cours) :
- [x] 2.0 Préréglages RG-14.5 dans le moteur (`presets.ts`) : Petit groupe, Standard, Grande foule + enregistrement d'un préréglage GM (seules les différences sont gardées).
- [x] 2.1 `apps/api` : Fastify 5, Drizzle 0.45 + PGlite 0.5 (dev/tests, en mémoire ou `PGLITE_DIR`) / `pg` (prod, `DATABASE_URL`). Schéma `src/db/schema.ts` : les 11 entités + `prereglages`, `staff`, `pertes` ; migrations `drizzle/` (`pnpm --filter @gq/api db:generate`) appliquées à l'ouverture. Seed : `pnpm --filter @gq/api seed` (partie de démo : 30 cartes, 6 zones, 20 balises). Helper de test `src/test/helpers.ts`.
- [x] 2.2 Journal RG-3.1 (`src/core/journal.ts`) et `Runner` (`src/core/runner.ts`) : toute action d'état passe par `runner.run(partieId, acteur, fn)` = verrou par partie + transaction + heure de jeu + `log()` + `emit()` diffusé seulement après commit (bus `src/core/bus.ts`). Motif obligatoire pour corrections et sanctions PNJ/GM.
- [x] 2.3 Auth : jetons signés HMAC (`src/auth/tokens.ts`, rôle + id + partie), `requireRole` (GM ⊇ PNJ). Création de partie : `POST /admin/parties` avec l'en-tête `x-code-admin` (`GQ_ADMIN_CODE`), crée le premier GM. Équipe : connexion par code (`/parties/:id/staff/connexion`), ajout par un GM, journal lisible par l'équipe. Jeton joueur délivré à l'inscription (2.4). Erreurs : `{ ok: false, code, message }` (`src/errors.ts`), requêtes validées par Zod (`@gq/shared/api.ts`).
- [x] 2.4 Inscription RG-5 : moteur `registration.ts` (Examen, test de Nen, kit, rattrapage) ; routes `src/routes/joueurs.ts` : `POST /inscription` (pseudo, appareilId, position obligatoire), `/reconnexion`, `GET /questionnaires`, `POST /examen`, `POST /nen`, `GET /moi`. Nouveaux paramètres RG-14 : `kitJenny`, `bonusExamenJ`, `specialisationPct`, `rattrapageJParMin`. Paramètres lus via le service unique `src/core/params.ts`.
- [x] 2.5 Licence RG-5.2 (`src/core/licence.ts`) : `GQL1.<joueurId>.<fenêtre 30 s>.<HMAC du secret joueur>`, ±1 fenêtre tolérée ; `GET /licence` (joueur), `POST /licence/verifier` (équipe). Le secret est donné par `/moi` pour que l'app calcule la licence hors ligne.
- [ ] 2.6 Intentions (en cours) :
  - [x] Couche base ⇄ moteur `src/core/state.ts` (`loadBooks` / `saveBooks` : différences de Livres, transferts, sorts utilisés, pertes ; balises, catalogue, circulation, événements).
  - [x] `POST /position` (journalisée, alerte vitesse RG-15, envoyée au GM seulement) et `POST /scan` (RG-7 complet, tirage RG-8.3, Double gain, épuisement + remplacement RG-6.3, scan hors ligne RG-7.5, alerte photo partagée RG-15, diffusion joueur / équipe / écran).
  - [x] Sorts `src/routes/sorts.ts` : `GET /a-portee` (pseudos seulement), `POST /sort` (8 sorts + pouvoirs Émission / Manipulation), `POST /transformation` (RG-5.4) ; alerte à la cible, fil de l'écran, Analyse privée.
  - [x] Boutique `src/routes/boutique.ts` : `GET /boutique`, `POST /boutique/achat`, `POST /boutique/revente` (QR du lieu exigé, vague en base `parties.vague_boutique`, Krach, révélation Masadora). Zones de lieu (Masadora, Antokiba, Soufrabi) : colonne `qr`.
  - [x] Échanges `src/routes/echanges.ts` (table `echanges`) : `POST /echanges` (proposition), `/echanges/:id/reponse|offre|valider|annuler`, `GET /echanges/courant` ; une session active par joueur ; cartes engagées verrouillées (revente, échange forcé, Transformation) ; pas d'Analyse pendant un échange (RG-10.8).
  - [ ] Enchères.

**Prochaine étape** : 2.6 suite (enchères). Le calibrage n'est pas bloquant : tout passe par des paramètres.

## Reprise de session (lire en premier)
- Phase 1 terminée et poussée (`main`, dernier commit « Simulateur v2 »). Engine pur dans `packages/engine/src/` : un module par domaine (`params`, `draw`, `book`, `scan`, `beacons`, `geo`, `spells`, `counterfeits`, `trades`, `shop`, `ranking`, `lifecycle`, `events`) + `sim/`. Chaque module a son `*.test.ts`.
- Conventions de code : fonctions pures, Rng injecté, horloge de jeu (`gameClock`), refus `{ ok: false, code, message }` en français, ids RG en commentaire.
- Commits : auteur git local « Sivraj » ; messages en français ; push sur `origin main` après chaque tâche. Pour les modifications de docs multi-lignes, passer par un script Python dans le scratchpad (les heredocs avec apostrophes cassent le shell).
- Décisions de calibrage **en attente** (ne pas appliquer sans accord) : voir la section suivante.

## Calibrage — propositions en attente de validation (simulation v2)
- Limites d'exemplaires × 2 par défaut (mode Multiplicateur RG-14.2).
- Conseil d'organisation : ≈ 0,75 balise posée par joueur attendu (min 10).
- Chiffrer dans le document les sources de hauts rangs : checkpoints PNJ (nombre, rangs, rythme), énigmes, enchères, arène de Soufrabi.
- Accès aux SS : limiteSS ≥ 2 et une source régulière (Apparitions plus fréquentes en fin de partie, ou Soufrabi / enchères).
- Accepter qu'un Clear reste rare : la plupart des parties finissent au classement (RG-13.4).

## Ambiguïtés du document (choix validés par Sivraj le 2026-10-09, réglables)
- RG-6 vs tableau RG-8 : balise standard « rangs D à A » mais le tableau donne 1 % de S en standard → S exclu en standard (`draw.ts`).
- Poids des rangs en balise rare (« poids relevés ») non chiffrés → S 15, A 25, B 30, C 30.
- Balise fantôme : SS 50 / S 50, et toujours une carte (ni sort ni jenny).
- Montant d'un gain jenny non fixé → 10 J. Répartition des sorts tirés → uniforme ; « sort de rareté commune » (RG-5.5) : rareté des sorts non définie.
- RG-7.2 : un rang au-dessus du plafond est ramené au plafond (et non retiré puis renormalisé).
- RG-8.3 : si le rang tiré et tous les rangs inférieurs sont épuisés → jenny, même si un rang supérieur reste dispo.
- RG-14.1 « baisse limitée à un palier toutes les 10 min » : interprété comme une baisse appliquée au plus une fois par fenêtre de 10 min.
- RG-14.2 multiplicateur : arrondi à l'entier le plus proche.
- RG-8.5 « Livre plein » vérifié avant le tirage (étape 6 de RG-7, le gain n'est pas encore connu) : plein = 15 emplacements libres occupés, même si un emplacement désigné est vide.
- RG-8.5 : l'emplacement désigné revient au premier exemplaire obtenu ; s'il part, le doublon suivant le reprend.
- Livre plein et réception par vol / échange / échange forcé : débordement autorisé ; scan interdit tant que les emplacements libres occupés sont ≥ 15 (validé le 2026-10-09).
- RG-7.3 « 30 s entre deux scans » : compté depuis le dernier tirage réussi (un refus ne coûte rien, RG-7.4). (validé)
- RG-7 étape 2 : un joueur « inactif » (RG-5.7) peut scanner, l'action le rend actif ; seuls disqualifié, abandon et gelé sont refusés. (validé)
- RG-6.4 rotation : 30 % des actives arrondi, au moins 1 ; balises retirées au hasard (→ dormantes, non réactivables dans la même rotation) ; remplaçantes par zone la moins visitée (visites + activations du tour), tirage au hasard en cas d'égalité.
- RG-6.3 remplacement : si aucune dormante hors de la zone épuisée, la zone épuisée redevient éligible.
- RG-14.3 : une baisse de la cible de balises actives ne coupe aucune balise ; on ne réactive simplement pas.
- RG-10.11 marge GPS = somme des précisions du lanceur et de la cible, plafonnée à 20 m.
- RG-7.6 position valide : < 2 min, coordonnées correctes, précision ≤ 100 m (seuil proposé).
- RG-15 vitesse : distance moins les deux précisions, sur un intervalle ≥ 5 s (évite les fausses alertes dues au bruit GPS).
- RG-10.11 : portée (`porteeSortsM`, 30 m) et plafond de marge GPS (`margeGpsMaxM`, 20 m) sont des paramètres de partie ; à réduire pour un petit lieu (parking). À valider sur le terrain.
- Sorts : un refus ne consomme rien ; un sort accepté est consommé même s'il est bloqué (Barrière/Renforcement) ou sans effet (rien à voler).
- RG-10.2 : immunité de 5 min seulement si le sort réussit (pas s'il est bloqué ou sans effet). Viser un joueur immunisé est refusé (sort conservé).
- RG-10.3 : le délai de 2 min court dès qu'un offensif est lancé, même bloqué.
- Vol / Échange forcé prennent uniquement des cartes (jamais des sorts) ; l'exemplaire reçu compte comme « obtenu maintenant » (relance l'immunité SS RG-8.11).
- Gel (sort) bloque uniquement les scans ; le statut « gelé » (sanction PNJ) bloque aussi les sorts.
- Émission ne contourne pas « hors radar », seulement « hors portée » ; non consommée si la cible était à portée.
- Radar : la cible est prévenue (diffusion « Sort lancé : lanceur et cible notifiés »).
- Duplication d'une contrefaçon : toujours une contrefaçon.
- RG-10.8 « jamais les cartes d'un échange en cours » : Analyse refusée tant que le joueur a une session d'échange ouverte ; ses cartes engagées ne peuvent être ni revendues, ni données par échange forcé, ni transformées. Un Vol peut quand même les prendre (au hasard) : l'échange échoue alors à la validation et les parts sont à recomposer.
- Échange qui échoue à la double validation (carte partie, jenny manquants) : les deux validations tombent, la session reste ouverte.
- Transformation : seul un vrai exemplaire dont le joueur a au moins un autre exemplaire (vrai ou non) peut être déguisé ; recharge 20 min depuis la dernière utilisation, disponible dès le début.
- Expertise PNJ (RG-8.8) : payée même si rien n'est trouvé ; le Livre entier inclut les emplacements libres.
- Masadora révèle la contrefaçon vendue (RG-8.9) : prix selon ce qu'elle est vraiment (copie → 1 J ; déguisé → prix de sa vraie carte). Une SS apparente non démasquée est refusée comme une vraie SS (rien n'est révélé).
- Échanges : seules les cartes et les jenny s'échangent (pas les sorts) ; refusés pour un joueur gelé (sanction PNJ), disqualifié, ayant abandonné, ou au Livre gelé (Clear provisoire).
- Échanges : la portée est vérifiée à la proposition seulement ; une fois la session ouverte, s'éloigner ne l'annule pas. Tout le reste (cartes encore présentes, jenny, fréquence) est revérifié à l'exécution.
- Enchères : prix de départ fixé par le PNJ (1 J par défaut), surenchère d'au moins 1 J, offre limitée aux jenny possédés ; à la clôture, si le meilleur enchérisseur ne peut plus payer, l'offre précédente d'un autre joueur l'emporte.
- Boutique : achat et revente exigent le scan du QR de la boutique et un GPS valide ; refusés aux joueurs gelés (sanction), disqualifiés, ayant abandonné.
- Achat : refusé s'il reste moins de 3 emplacements libres (l'achat ne fait jamais déborder le Livre). Revente : cartes uniquement, pas les sorts.
- Vagues : numérotées depuis le début de la partie (horloge de jeu, donc suspendue en pause) ; stock calculé à l'ouverture de la vague.
- Krach de Masadora : prix multiplié par 0,5, arrondi au jenny supérieur.
- RG-9.5 roulette : non codée, lots et coût à définir.
- Classement live : compte ce que montrent les emplacements désignés (contrefaçons comprises, sauf copie déjà démasquée par son détenteur, qui libère l'emplacement). Final : vrais exemplaires, un doublon déguisé compte pour sa vraie carte.
- RG-13.5 critère 2 « somme des rangs » : des cartes désignées distinctes comptées au critère 1 (pas des doublons). Critère 4 : heure du premier exemplaire de chaque carte comptée, puis la plus tardive ; sans carte = dernier.
- Ex æquo parfaits : même place (1, 1, 3). Disqualifiés absents du classement ; abandons classés.
- RG-13.1 Clear : vérifié sur les emplacements désignés ; refusé avec la page de la première contrefaçon trouvée.
- RG-13.3 : les 3 cartes de récompense sont 3 cartes désignées distinctes, vraies, du Livre du gagnant.
- Cycle de vie : la pause est possible en cours et en phase finale, et ramène à l'état d'avant. Le GM peut terminer depuis la pause. Les inscriptions restent possibles pendant une pause si elles sont ouvertes. Le GM ne peut que fermer les inscriptions (pas les rouvrir).
- Clear confirmé : refusé pendant la pause (RG-4 cite En cours et Phase finale).
- Horloge de jeu : 0 au démarrage, arrêtée pendant la pause ; toutes les heures du moteur sont en horloge de jeu.
- Événements : lancés seulement en cours ou en phase finale ; zone (Apparition, Double gain, Zone maudite) = un à la fois par zone ; globaux cumulables, sauf une seule carte maudite à la fois.
- Double gain : 2 gains par tirage, le stock de la balise ne baisse qu'une fois ; les limites d'exemplaires restent absolues.
- Apparition : une balise dormante de la zone passe en fantôme ; refusée s'il n'y en a pas ; à la fin, la fantôme non épuisée redevient dormante.
- Raid : 1 PV par bonne réponse, une fois par question et par joueur ; participant = au moins une bonne réponse ; récompense : 3 sorts par participant (débordement du Livre toléré). Questions à écrire (Phase 2).
- Carte maudite : imite une carte du catalogue, ne compte jamais (comme une contrefaçon) ; son porteur la voit maudite, les autres la voient normale ; arrive chez un joueur actif au Livre non gelé ; à l'échéance, disparaît et le porteur perd 2 cartes hors SS (Livre gelé épargné) ; annulée = disparaît sans pénalité.
- Mission secrète : durée par défaut 20 min, récompense en jenny fixée par le GM, aucune annonce.
- RG-8.12 : SS rendues = vraies SS seulement ; inactif depuis 20 min, abandon ou disqualification.
- RG-12.3 agenda automatique : reporté en Phase 2 (planification).
- Catalogue de démo : 30 noms neutres proposés (habillage à trancher), n° 001-002 SS, 003-005 S, 006-010 A, 011-016 B, 017-023 C, 024-030 D. Zones de démo : Masadora, Antokiba, Soufrabi + 3 zones sauvages.
- Livre : pas de colonne « emplacements » ; la mise en page est recalculée par le moteur (`layoutBook`) à partir des exemplaires, sorts non utilisés et pertes. Table `livres` = état du Livre (gelé par un Clear provisoire).
- RG-5 : kit = 50 J (comme le simulateur) + 1 sort uniforme ; Examen = 10 J par bonne réponse, une seule tentative ; Spécialisation 5 % tirée avant le questionnaire, sinon type le plus choisi (égalité au hasard) ; test de Nen une seule fois, non obligatoire pour jouer (sans Nen, aucun passif). Questions de l'Examen et du test de Nen **provisoires** (`engine/registration.ts`).
- RG-5.6 rattrapage : 2 J par minute de jeu écoulée (paramètre `rattrapageJParMin`, 0 = désactivé).
- RG-5.1 : `appareilId` = identifiant aléatoire créé par l'app et gardé sur le téléphone ; il sert aussi à se reconnecter. 2e inscription du même appareil refusée + alerte RG-15 à l'équipe. La position est exigée à l'inscription (« géoloc obligatoire »).
- RG-5.2 : licence acceptée sur la fenêtre de 30 s courante ± 1 (décalage d'horloge du téléphone, temps de scan), soit 60 à 90 s de validité réelle.
- Positions : chaque envoi est journalisé (historique pour la heatmap décalée de l'écran, RG-10.12). Un scan porte sa propre position ; la validité GPS (RG-7.6) est jugée sur la position du scan (un scan hors ligne garde la sienne).
- RG-7.5 : l'âge d'un scan hors ligne est mesuré en heure réelle (horloge du téléphone vs serveur).
- RG-15 photo partagée : comparée aux scans (réussis ou refusés) de la même balise des 10 dernières secondes.
- Sans test de Nen passé, un joueur n'a aucun passif (ni Renforcement, ni Émission…).
- RG-9.2 / 11.4 : chaque lieu (Masadora, Antokiba, Soufrabi) a un QR secret affiché sur place ; l'app l'envoie avec l'achat / la revente / l'enchère comme preuve de présence. Prix de boutique réglables par partie (`parties.reglages_boutique`).
- RG-14.5 : contenu des préréglages non défini → proposé : Petit groupe = portée 20 m, marge GPS 10 m, limites d'exemplaires × 2 ; Standard = défauts du document ; Grande foule = portée 20 m, marge GPS 15 m (foule dense). Les formules auto suivent déjà J.

## Feuille de route
1. **Phase 0 — Cadrage** : stack, environnement, `git init`.
2. **Phase 1 — Moteur (`packages/engine`)** : formules RG-14, tirage RG-8.3, vérifs de scan RG-7, Livre RG-8.5, classement RG-13.5, sorts RG-10. Tests unitaires par RG. Script de simulation (points ouverts : calibrage).
3. **Phase 2 — API (`apps/api`)** : schéma BDD (11 entités), cycle de vie RG-4, inscription/licence RG-5, endpoints d'intentions, journal, Socket.IO (diffusion RG « temps réel »), tâches planifiées (J toutes les 2 min, rotation 20 min, recharge balises, vagues boutique).
4. **Phase 3 — App joueur (`apps/player`)** : PWA, scan QR, Livre, sorts, échanges, file hors ligne RG-7.5.
5. **Phase 4 — Console PNJ/GM (`apps/staff`)**.
6. **Phase 5 — Écran géant (`apps/tracker`)**.
7. **Phase 6 — Test terrain** : portée GPS, calibrage.

## Décisions prises
_(date — décision — raison)_
- 2026-10-09 — Stack TypeScript monorepo validée (voir CLAUDE.md) — moteur testable isolément, un seul langage pour api et fronts.
- 2026-10-09 — Ordre : engine avant api — l'engine porte la logique métier, l'api l'orchestre.
- 2026-10-09 — Balises toutes identiques ; type (standard/rare) tiré par le serveur à chaque activation, `partRaresPct` = 15 % ; fantôme = mode temporaire d'une balise quelconque (amendement RG-6 dans REGLES.md).
- 2026-10-09 — Échanges à la Pokémon (amendement RG-11.1) : liste des joueurs à portée, proposition, acceptation, composition des deux parts, double validation ; cartes + jenny. Plus de scan de licence pour échanger.
- 2026-10-09 — Une seule instance d'API par partie : les actions d'une partie sont sérialisées par un verrou en mémoire, en plus de la transaction. Raison : ≤ 80 joueurs, simplicité, aucune course entre deux scans sur la même balise. Passer à un verrou PostgreSQL (`pg_advisory_xact_lock`) si on veut plusieurs instances.
- 2026-10-09 — Pas de Docker. Dev et tests : PGlite (PostgreSQL embarqué, zéro installation) via Drizzle ; prod : PostgreSQL hébergé. Raison : rien à installer sur le poste Windows, même dialecte SQL qu'en prod.

## Points ouverts (repris du document de règles)
- Nom / habillage · Clear = fin de partie ou phase finale ? · Compte joueur persistant ? · Pouvoirs de Spécialisation, contenu Examen et test de Nen · Portée 30 m · Calibrage.
