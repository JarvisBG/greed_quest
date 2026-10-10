# Prompt — Interfaces de Greed Quest

> Prompt à donner tel quel à une session Claude Code ouverte à la racine du dépôt, **une application à la fois** (dans l'ordre : système visuel commun → `apps/staff` → `apps/tracker` → refonte de `apps/player`). Rédigé le 2026-10-10 d'après l'état réel de l'API (routes, schémas Zod, évènements Socket.IO). Si l'API change, mettre à jour la section « Périmètre » avant de relancer.

---

## 0. Rôle et cadre

Tu conçois et tu codes les interfaces de **Greed Quest**, une chasse au trésor sur le terrain inspirée de *Greed Island* (arc de *Hunter × Hunter*) : des balises QR physiques à scanner, un Livre de cartes numérotées à compléter, des sorts lancés sur les joueurs proches (GPS), des échanges, des enchères, une arène, des évènements lancés par un Game Master. Client : loJIC Solutions.

Le moteur (`packages/engine`) et l'API (`apps/api`) sont **terminés et testés**. Ton travail est **uniquement côté interfaces** : tu ne modifies ni les règles ni l'API, sauf pour les manques listés en § 6, et seulement après accord.

Langue : **français** partout (textes, commentaires, commits). Le joueur est tutoyé (c'est déjà le cas : « Attends encore 26 s »). L'équipe (PNJ, GM) lit des libellés neutres et des verbes à l'infinitif (« Geler 5 min », « Confirmer le Clear »).

**Avant toute ligne de code** : charge le skill `impeccable`, lis les fichiers du § 1, puis présente à Sivraj une maquette de l'application visée (structure des écrans, palette, typographie, un écran clé dessiné) et **attends sa validation**. Une application à la fois.

## 1. À lire avant de commencer (et rien d'autre au départ)

1. `CLAUDE.md` — stack, règles d'architecture non négociables.
2. `docs/PROGRESS.md`, section « Reprise de session » puis « Calibrage » (amendements récents : objets, Nen rechargeable, Spécialisation, arène, Regard).
3. `docs/REGLES.md` — règles condensées ; sections RG-3 (rôles), RG-10.12 (positions), « Diffusion temps réel ».
4. `packages/shared/src/api.ts` (corps des requêtes) et `packages/shared/src/domain.ts` (vocabulaire : rangs, états, statuts, Nen, sorts, objets).
5. L'application joueur existante `apps/player/src` : **réutilise ses patrons** (`lib/api.ts`, `lib/realtime.ts`, `lib/session.ts`, `lib/format.ts` pour les libellés, `ecrans/CameraQr.tsx`, logique pure testée dans `lib/`). Pas de bibliothèque d'état, pas de routeur : navigation par état, comme dans `App.tsx`.
6. Pour une route précise : le fichier `apps/api/src/routes/<domaine>.ts` correspondant (forme exacte de la réponse). Ne devine jamais une forme de réponse : lis la route.

Brouillon existant : `apps/staff/` (non commité, non vérifié : squelette, Connexion, Joueur, Checkpoints). Reprends ses `lib/` s'ils sont justes ; refais les écrans.

## 2. Direction artistique

### 2.1 Thème : *Hunter × Hunter*, arc *Greed Island*, pleinement assumé
**Décision de Sivraj (2026-10-10)** : l'habillage assume l'anime. Les joueurs sont des fans ; ils doivent se sentir **dans** Greed Island, pas dans un jeu « qui y ressemble ». Les noms, le vocabulaire et les codes visuels de l'œuvre sont permis. Seule limite technique : on n'intègre que des images et polices dont on dispose réellement (pas d'image téléchargée au hasard) ; tout le reste est dessiné en SVG / CSS. Les droits sur l'œuvre relèvent du client.

Ce que l'interface reprend de l'anime :
- **Le Livre** (« Book ») : le classeur qu'on invoque en disant « Book ». L'ouverture du Livre dans l'app est le geste signature (le mot « Book » peut apparaître à l'ouverture). Pochettes numérotées, cartes à numéro à trois chiffres (`001`), nom, **lettre de rang** dans un coin, encadrement et fond selon le rang, comme les cartes de Greed Island ; dos de carte commun. Emplacement vide : numéro en creux. Cette carte est dessinée avec soin une fois et réutilisée partout (joueur, console, écran géant).
- **Les rangs** SS, S, A, B, C, D : échelle de couleurs et de matières (SS précieuse, D sobre). La lettre fait toujours foi (daltonisme).
- **La voix du jeu** : dans Greed Island, une annonce système prévient le joueur (« Le joueur X a utilisé un sort sur toi »). Toutes les alertes de sort, d'évènement, de sanction et le fil de l'écran géant adoptent ce ton et cette forme : bandeau sec, typographie « système du jeu ».
- **L'écriture Hunter** (alphabet de l'anime, polices de fans disponibles) : autorisée en **décor** (titres d'en-tête, dos de carte, emblème de la licence, écran d'attente du tracker), jamais pour porter une information, toujours doublée en français.
- **Le Nen** : diagramme hexagonal des six types (Renforcement, Émission, Transformation, Matérialisation, Manipulation, Spécialisation, dans l'ordre de l'anime), divination par le verre d'eau pour la révélation du test de Nen, couleur d'aura par type.
- **La licence de Hunter** : la licence QR prend la forme de la carte de licence de l'anime (format carte, emblème Hunter redessiné, pseudo, type de Nen, QR tournant au centre).
- **L'Examen Hunter**, les **villes** (Masadora la ville des sorts, Antokiba la ville des enchères, Soufrabi l'arène), la **Brigade** du raid, le **Clear** : chacun a son identité visuelle dans l'esprit de l'anime.
- **Les Game Masters** : la console GM peut s'inspirer de la salle de contrôle des créateurs du jeu ; l'écran géant, d'une retransmission du monde de Greed Island.
- Vocabulaire : « Book », « Clear », « Hunter », « Nen », « Zetsu », « jenny » sont employés tels quels. Les noms de sorts restent ceux des règles (Vol, Gel, Regard…) car ils sont déjà dans l'API et les tests ; le nom anglais de l'anime peut figurer en sous-titre (Regard · *Peek*).
- Ambiance : nuit, or patiné, encre, papier de carte. Base actuelle de l'app joueur (**sombre doré**) conservée et affinée.

L'ambition « anime assumé » ne lève aucun interdit du § 2.2 : on fait un produit de fan exigeant, pas un collage.

### 2.2 « Pro, sans marqueurs IA » : interdits explicites
- Pas de dégradé violet-bleu, pas de glassmorphism, pas de halo flou derrière les titres, pas de fond « aurora ».
- Pas d'emoji comme icône ni dans les textes (✨ 🎉 🚀 ✅). Une seule famille d'icônes, cohérente (Lucide, ou SVG maison pour les sorts, objets et Nen).
- Pas de grille de cartes toutes identiques « icône en haut, titre, deux lignes de texte ». Hiérarchie réelle : ce qui compte le plus est le plus gros.
- Pas de rayon de 16 px et d'ombre douce partout. Coins, bordures et ombres choisis par rôle.
- Pas d'Inter / Poppins / Montserrat par défaut. Une typographie de titrage à caractère (au choix avec impeccable) + une typographie de texte très lisible + une chasse fixe pour les numéros de carte, les jenny et les chronos (chiffres tabulaires).
- Pas de texte marketing (« Libère ton potentiel », « Bienvenue dans l'aventure ! »), pas de point d'exclamation en série, pas de tiret cadratin à chaque phrase, pas de Majuscules À Chaque Mot.
- Pas de donnée inventée, de « Lorem ipsum », de « John Doe », de statistique décorative. Chaque nombre affiché vient de l'API.
- Animations : seulement quand elles portent une information (carte tirée qui se retourne, bandeau d'alerte qui entre, barre de vie qui baisse, chrono qui passe au rouge). `prefers-reduced-motion` respecté. Aucune animation en boucle sur le téléphone (batterie).
- Pas de toast pour confirmer ce qui est déjà visible à l'écran.

### 2.3 Système visuel commun
Crée un paquet `packages/ui` (`@gq/ui`, exporte `src/` directement comme `@gq/shared`) contenant :
- `tokens.css` : couleurs (fond, surfaces, texte, or, alerte, succès, couleurs des 6 rangs, des 6 Nen), typographie, espacements, rayons, ombres, durées d'animation ; thème sombre unique (le terrain est souvent le soir) ; contraste AA minimum, AAA pour les chiffres clés au soleil.
- Composants React partagés, sans logique métier : `Carte` (recto, emplacement vide, emplacement perdu « Volée par X à 14h05 », contrefaçon démasquée grisée, badges maudite / dans un échange / coffre), `Rang`, `Jenny` (montant + symbole), `Chrono` (décompte, figé en pause, rouge en phase finale), `Bandeau` (annonce système), `Etat` (pastille de connexion), `LecteurQr` (reprend `CameraQr.tsx`), `Confirmation` (action en deux temps), `Vide` (état vide avec une phrase utile).
- Les libellés français (`SORTS`, `NENS`, `OBJETS`, `POUVOIRS_SPE`, rangs, états) restent dans `apps/player/src/lib/format.ts` : déplace-les dans `@gq/ui` pour que les trois apps parlent pareil.

## 3. Contraintes techniques communes

- React 19 + Vite 8, TypeScript strict, CSS simple avec les tokens (pas de bibliothèque de composants, pas de Tailwind : le rendu générique est précisément ce qu'on évite).
- Carte géographique (console GM, écran géant) : **Leaflet** + tuiles OpenStreetMap, sauf meilleure proposition validée.
- **Serveur autoritaire** : l'interface envoie des intentions (corps Zod de `@gq/shared`), affiche les réponses. Elle ne calcule jamais un résultat de jeu. Les seuls calculs locaux autorisés : décomptes de temps à partir des `restantMs` / `delais` reçus, licence QR (déjà fait), conseils d'organisation importés de `@gq/engine` (fonctions pures).
- Refus : l'API renvoie `{ ok: false, code, message }` avec un message déjà rédigé en français : **l'afficher tel quel**, à côté de l'action, sans le reformuler.
- Temps réel : Socket.IO, `auth: { token }` (joueur, PNJ, GM) ou `auth: { tracker: partieId }` (écran). Au (re)branchement, recharger l'état par HTTP puis appliquer les évènements.
- Chaque écran prévoit ses états : chargement, vide, erreur, hors ligne, refus, partie en pause, partie terminée.
- Logique d'affichage non triviale dans `src/lib/*.ts`, pure et testée (Vitest), comme dans `apps/player`.
- Vérification réelle dans Chrome à chaque écran (méthode décrite dans PROGRESS, « Reprise de session »), en plus des tests.

## 4. Périmètre exact

Légende des rôles : **J** joueur · **P** PNJ · **G** GM (G peut tout ce que P peut) · **E** écran géant (public, lecture seule).

### 4.1 `apps/staff` — Console PNJ / GM

**Deux profils d'appareil** : le PNJ est debout sur le terrain avec un téléphone (scanne des licences, une main) ; le GM est assis devant un ordinateur portable ou une tablette (vue dense, carte, plusieurs panneaux). Même application, mise en page adaptée à la largeur et au rôle reçu à la connexion.

Socket : P rejoint la room `staff`, G rejoint `staff` + `gm`. Évènements reçus : `journal`, `alerte`, `balises`, `partie`, `j`, `parametre`, `joueur_inscrit`, `evenement`, `evenement_fin`, `raid`, `enchere`, `enchere_close`, `demande_clear`, `recompenses`, `classement_final` ; G seul : `position`, `proposition_evenement`.

**Commun P et G**

| Écran | Contenu | API |
|---|---|---|
| Connexion | Identifiant de partie (pré-rempli par `?partie=`) + code personnel. Session gardée sur l'appareil. | `POST /parties/:id/staff/connexion` → `{ id, role, nom, token }` |
| Barre permanente | Nom de la partie, état (RG-4), chrono, J actifs, pastille de connexion, nom et rôle du membre, compteur d'alertes non lues. | `GET /parties/:id`, évènements `partie`, `j` |
| Scanner une licence | Action principale du PNJ, accessible en un geste. Lit le QR de licence du joueur, affiche sa fiche (pseudo, statut, Nen renvoyés par la route ; jenny et gel en cours complétés par `GET /joueurs`) puis propose les actions possibles **pour ce lieu** : checkpoint, expertise, arène, sanction. | `POST /licence/verifier` `{ qr }` |
| Checkpoints | Liste des checkpoints (zone, défi, cartes en stock, arbitre). Réussite : licence scannée → choix d'une carte du stock et/ou de jenny (0 à 500) → confirmation. Affiche le bonus Matérialisation éventuel renvoyé. | `GET /checkpoints`, `POST /checkpoints/:id/reussite` `{ licence, carteId?, jenny }` |
| Expertise (Antokiba) | Licence scannée → une page (10 J) ou tout le Livre (25 J) → résultat (le joueur le reçoit aussi). | `POST /expertise` `{ licence, page? }` |
| Arène (Soufrabi) | Entrée par licence (mise prélevée, `areneMiseJ`), défis en cours avec chrono, issue Victoire / Défaite (gain annoncé), annulation motivée = mise remboursée. Refus clairs (délai de 15 min, une tentative à la fois). | `GET /arene`, `POST /arene/entree` `{ licence }`, `/arene/:id/issue` `{ victoire }`, `/arene/:id/annuler` `{ motif }` |
| Enchères (Antokiba) | Ouvrir une enchère (carte du catalogue, prix de départ, 3 min), suivre les offres en direct, clôturer. Enchère de la SS autorisée (dans la limite). | `GET /cartes`, `POST /encheres` `{ carteId, prixDepart }`, `GET /encheres`, `POST /encheres/cloturer`, évènements `enchere`, `enchere_close` |
| Missions | Missions secrètes en cours (joueur visé, objectif, récompense, temps restant) → « Valider » quand le PNJ constate la preuve (c'est la « photo-preuve » du tableau RG-3 : la preuve est montrée au PNJ, rien n'est envoyé au serveur). | `GET /evenements`, `POST /evenements/:id/valider` |
| Joueurs | Liste (pseudo, statut, Nen, pouvoir de Spécialisation, jenny, gel) avec recherche. **Jamais de position.** Fiche joueur → sanctions. | `GET /joueurs` |
| Sanctions | Avertir, Geler 5 min, Annuler les gains d'une balise + gel (photo de balise). **Motif obligatoire** (3 à 200 caractères), confirmation en deux temps. | `POST /sanctions/avertissement`, `/sanctions/gel`, `/sanctions/annulation-gains` |
| Alertes | Fil des alertes anti-triche (double inscription, vitesse, photo partagée, échanges déséquilibrés, rythme de scan, sans position) avec heure, joueurs concernés, et le raccourci de sanction adapté (ex. photo partagée → annulation des gains de cette balise). Le serveur alerte, l'humain décide. | `GET /alertes`, évènement `alerte` |
| Journal | Toutes les actions (acteur, action, résultat, motif), filtrable par joueur, acteur, type ; chargement incrémental. | `GET /journal?apres&limite`, évènement `journal` |

**GM seulement**

| Écran | Contenu | API |
|---|---|---|
| Créer une partie | Hors session : nom, préréglage, partie de démonstration oui / non, nom et code du premier GM, code administrateur. Donne ensuite le lien d'accueil joueurs, le lien console et le lien écran géant. | `POST /admin/parties` (en-tête `x-code-admin`) |
| Tableau de bord | Cycle de vie : actions possibles selon l'état (ouvrir les inscriptions, démarrer, pause, reprendre, phase finale, fermer les inscriptions, terminer), avec confirmation et motif facultatif. Chrono, J, nombre d'inscrits, balises actives / cible, évènements en cours, demandes de Clear, alertes récentes. Refus de démarrage affiché tel quel (ex. catalogue incomplet). | `POST /cycle` `{ action, motif? }` |
| Préparation (Brouillon) | Parcours guidé, dans cet ordre : **Zones** (dessin du polygone sur la carte, type Masadora / Antokiba / Soufrabi / sauvage ; le QR de lieu est affiché) → **Balises** (zone, libellé, position de pose facultative) → **Catalogue** (7 à 60 cartes, une seule SS, nom, rang, lot réel ; conseil de N et de répartition calculés par `conseilCartesDesignees` et `repartitionCatalogue` de `@gq/engine`, non bloquants) → **Checkpoints** (zone, défi, stock de cartes, arbitre ; conseil `conseilOrganisation`) → **Paramètres** → **Équipe**. Chaque étape montre ce qui manque pour démarrer. | `GET/POST /zones`, `GET/POST /balises`, `PUT /catalogue`, `PATCH /cartes/:id`, `POST /checkpoints`, `GET/POST /staff` |
| Planche d'impression | Page imprimable (A4, CSS `@media print`) : QR de chaque balise (libellé lisible sous le QR, format `…?balise=<id>`), QR des lieux (Masadora, Antokiba, Soufrabi), QR d'accueil joueurs (`?partie=<id>`). Nécessaire pour la partie test (PLAN 6.2). | données de `GET /balises`, `GET /zones` |
| Carte | Fond de carte + polygones des zones + balises (état : dormante, active, épuisée, coupée ; type tiré : standard, rare, fantôme ; stock) + **positions exactes des joueurs** (pseudo, statut, fraîcheur de la position). Actions sur une balise : activer, couper, endormir (motif), rotation forcée. | `GET /balises`, `GET /positions`, `POST /balises/:id/etat`, `POST /balises/rotation`, évènements `balises`, `position` |
| Paramètres | Pour chaque paramètre RG-14 : J, valeur auto, mode (Auto / Verrouillé / Multiplicateur), valeur appliquée (RG-14.6). Modification en ligne. Préréglages : liste, appliquer, enregistrer l'état courant. | `GET/PUT /parametres` `{ cle, reglage }`, `GET/POST /prereglages`, `POST /prereglages/appliquer` |
| Évènements | Lancer : Apparition, Double gain, Zone maudite (zone requise ; un seul évènement de zone à la fois), Raid de la Brigade, Krach de Masadora, Carte maudite, Mission secrète (joueur, objectif, récompense, durée). Durée par défaut du tableau RG-12, modifiable. Liste des évènements en cours avec temps restant et « Annuler ». Barre de vie du raid. Propositions de l'agenda automatique (si activé) : « Lancer » ou « Ignorer ». | `POST /evenements`, `/evenements/:id/annuler`, `GET /evenements`, évènements `evenement`, `evenement_fin`, `raid`, `proposition_evenement` |
| Clear | Demandes de Clear (Livre gelé, joueur qui vient voir le GM) → scan de la licence → « Confirmer le Clear » (termine la partie) ou « Refuser » avec motif. Ensuite : les 3 cartes choisies par le gagnant et leurs **lots réels** à remettre. | `POST /clear/confirmer` `{ licence }`, `/clear/annuler` `{ joueurId, motif }`, évènements `demande_clear`, `recompenses` |
| Corrections et disqualification | Sur la fiche joueur : ajuster les jenny (± montant), ajouter / retirer une carte du Livre, disqualifier. Motif obligatoire, confirmation en deux temps, rappel que tout est journalisé. | `POST /corrections/jenny`, `/corrections/livre`, `/sanctions/disqualification` |
| Fin de partie | Classement final figé (RG-13.5 : cartes désignées distinctes, points de rang, jenny, heure de la dernière carte), podium top 3 (lots organisateur, RG-13.6), gagnant du Clear. | évènement `classement_final` |

**Interdit dans la console** : toute action sans motif quand le motif est exigé ; toute position exacte pour un PNJ ; tout bouton GM visible par un PNJ (le serveur refuserait, l'interface ne le propose pas).

### 4.2 `apps/tracker` — Écran géant

Un téléviseur ou un vidéoprojecteur 16:9 (1920 × 1080, net en 4K), lu à 5 à 10 m, **sans aucune interaction** : pas de bouton, pas de défilement manuel, pas de survol. Ouvert par `?partie=<id>`. Plein écran, reconnexion automatique, aucun texte plus petit que l'équivalent de 24 px en 1080p.

Données : `GET /parties/:id/ecran` à l'ouverture (partie, classement, heatmap, balises par zone, évènements, 30 dernières entrées du fil, Clear), puis socket `auth: { tracker: partieId }` : `partie`, `classement`, `classement_final`, `balises_par_zone`, `heatmap`, `fil`, `progression`, `evenement`, `evenement_fin`, `raid`, `clear`.

| Zone de l'écran | Contenu |
|---|---|
| Bandeau haut | Nom de la partie, état, chrono géant (rouge en phase finale, « Pause » bien visible). |
| Classement live | Pseudo, cartes désignées distinctes / N, points de rang, jenny ; animations de dépassement sobres. Le classement live compte les contrefaçons (rien ne les trahit, RG-13.7). |
| Fil d'actualité | Entrées `tirage` (rang ≥ A), `sort` (lanceur, cible, sort, résultat ; **Regard est anonyme** : ni lanceur ni cible), `echange` (S ou SS), `arene` (victoire S ou SS). Phrases courtes, ton « annonce du jeu ». |
| Carte | Carte de chaleur anonyme décalée de 2 min, nombre de balises actives par zone. **Jamais** de balise localisée ni de point nominatif. |
| Bannières d'évènements | Type, zone, compte à rebours ; raid = barre de vie du boss en grand. Mission secrète et carte maudite précise : jamais montrées (seulement « une carte maudite circule »). |
| Avant le démarrage | Brouillon / Inscriptions : grand QR d'accueil (`?partie=<id>`) et consignes en trois lignes. |
| Clear | Plein écran : pseudo du gagnant. |
| Terminée | Podium top 3 puis classement final figé. |

Manque côté API pour la carte (voir § 6) : `GET /ecran` donne les zones sans leur polygone.

### 4.3 `apps/player` — Refonte visuelle et écrans manquants

L'application est **fonctionnelle et testée** (49 tests, parcours vérifiés). On garde `useJeu`, toute la logique de `src/lib/` et ses tests ; on refait la présentation avec `@gq/ui` et on ajoute ce qui manque. Téléphone tenu d'une main, en extérieur, parfois au soleil : cibles tactiles ≥ 48 px, actions principales en bas de l'écran, contrastes forts, vibration pour les alertes.

Écrans existants à refondre : choix de partie, Inscription, Kit, Examen, test de Nen (diagramme hexagonal), Accueil (hub : profil, chrono, évènements, raid, accès Masadora / Antokiba), Scanner (+ résultat du tirage : la carte se révèle), Livre (pages de 10, emplacements désignés / libres), Licence, Sorts, Échanges, Boutique, Enchères, Raid, bandeau d'alerte.

Écrans ou éléments **à ajouter** (l'API est prête, l'écran ne l'est pas) :
1. **Objets** : section Objets du Livre (8 places, à part) ; Gratter un Ticket ; Boussole (direction parmi 8, jamais de distance) ; Coffre scellé (choix de la carte protégée, minuterie) ; après un refus « boucle » au scan, proposer « Utiliser un Second souffle ? » (`secondSouffle: true`) ; revente d'objet à Masadora. `POST /objet`, `POST /scan`, `POST /boutique/revente`.
2. **Recharge du Nen** : temps restant du pouvoir (`delais.pouvoir`) et de la réserve de Matérialisation (`delais.reserve`) ; évènement `reserve`.
3. **Spécialisation** : bouton du pouvoir avec sa recharge (`delais.specialisation`) ; Alchimie (choix du doublon puis de la carte visée, même rang ou au-dessus, jamais la SS) ; Bandit (Vol sans carte, choix facultatif de la carte visée, jamais la SS : `POST /sort` source `pouvoir` + `carteVoulueId`) ; Zetsu (état « invisible » avec minuterie) ; Fortune (état « armée »). `POST /specialisation`.
4. **Regard** : cibles = `croises` de `GET /a-portee` ; afficher les cartes vues ; côté cible, alerte anonyme « Quelqu'un a consulté ton Livre ».
5. **Texture Surprise** : pour un doublon S, proposer aussi la SS comme apparence.
6. **Arène** : évènement `arene` (entrée, issue, remboursement) ajouté à `EVENEMENTS_JOUEUR` et affiché.
7. **Clear** : quand le Livre est complet, « Demander le Clear » (`POST /clear`) → Livre gelé, consigne « Va voir le Game Master » ; refus (page de la contrefaçon, sans la carte) ; confirmation → choix de 3 cartes = lots réels (`POST /clear/recompenses`). Évènements `clear`, `clear_confirme`, `clear_refuse`.
8. **Abandon** : dans un menu secondaire, confirmation en deux temps (`POST /abandon`).
9. **Fin de partie** : classement final (`classement_final`), sa place, le podium.
10. Sanction reçue, gel en cours et dégel : état visible tant qu'il dure (`sanction`, `degel`).

**Interdit côté joueur** : la position d'un autre joueur (seule la zone via Radar), l'emplacement d'une balise, le stock d'une balise, le Livre d'autrui hors sort Regard, le pouvoir de Spécialisation d'un autre joueur.

## 5. Hors périmètre

- Toute modification des règles, du moteur ou des formules.
- La roulette de Masadora (RG-9.5) : **non implémentée** côté API, pas d'écran.
- Comptes joueurs persistants entre parties (point ouvert).
- Notifications push hors de l'application (service worker push) : non prévues.
- Traductions : français seulement.

## 6. Manques côté API repérés (à valider avec Sivraj avant d'en dépendre)

1. **Livre d'un joueur pour le GM** : `POST /corrections/livre` attend `retirerItemId`, mais aucune route ne donne à l'équipe le Livre d'un joueur. Proposition : `GET /joueurs/:id/livre` (GM), vue complète avec contrefaçons marquées.
2. **Demandes de Clear au rechargement** : elles n'arrivent que par l'évènement `demande_clear` ; une console rechargée les perd. Proposition : les inclure dans `GET /joueurs` (Livre gelé) ou une route `GET /clear/demandes`.
3. **Polygones des zones pour l'écran géant** : `GET /ecran` ne donne que `id`, `nom`, `type`.
4. **Liste des parties** : aucune route ; le GM garde les liens donnés à la création (l'écran « Créer une partie » doit les rendre faciles à copier et à imprimer).
5. Les conseils d'organisation ne sont pas exposés par l'API : la console les calcule avec `@gq/engine` (pur, sans I/O), ce qui ajoute la dépendance `@gq/engine` à `apps/staff`.

Pour chacun : petit commit API séparé, test nommé avec l'id de règle, ligne de journal si action d'état. Rien d'autre côté serveur.

## 7. Méthode de travail

1. Une application à la fois : `@gq/ui` → console → écran géant → refonte joueur.
2. Pour chaque application : maquette validée par Sivraj (skill `impeccable`) → code écran par écran → tests de `lib/` → vérification dans Chrome (API en mémoire, partie de démo préparée par script, voir PROGRESS) → `pnpm typecheck` et `pnpm test` verts.
3. Commits en français, petits, un sujet par commit ; push sur `origin main`.
4. Fin de chaque tâche : mettre à jour `docs/PROGRESS.md` (fait, prochaine étape, choix d'interprétation à faire valider) et cocher `docs/PLAN.md`.

## 8. Critères d'acceptation

- Chaque route et chaque évènement listés au § 4 sont branchés dans l'application concernée, ou explicitement écartés avec la raison dans PROGRESS.
- Aucun texte, nombre ou nom inventé à l'écran ; tous les refus de l'API sont affichés tels quels.
- Aucune position exacte hors de l'écran Carte du GM (vérifier aussi le réseau dans les outils du navigateur).
- Contraste AA partout, AAA pour chrono, jenny et numéros de carte ; cibles ≥ 48 px sur téléphone ; lisible à 8 m sur l'écran géant.
- Un fan de *Hunter × Hunter* se sent dans Greed Island dès l'ouverture du Book ; une personne qui ne connaît pas l'anime comprend quand même chaque écran.
- Revue finale avec `impeccable` (critique et audit) sur chaque application : aucun des interdits du § 2.2.
