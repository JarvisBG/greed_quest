# Greed Quest

Chasse au trésor numérique sur le terrain (inspirée de Greed Island) : balises QR physiques, cartes à collectionner, sorts ciblant les joueurs proches (GPS), échanges, événements lancés par un Game Master. Client : loJIC Solutions (Sivraj). Langue du projet : **français** (docs, messages joueurs, commits).

## Où lire quoi (économiser les tokens)
- `docs/REGLES.md` : règles de gestion condensées (RG-x.y). **Lire ça, pas le .docx.** Ne relire que la section utile.
- `docs/PROGRESS.md` : avancement, prochaine étape, décisions prises. À lire en début de session, à mettre à jour en fin de tâche.
- `Greed Quest - Règles de gestion.docx` : source de vérité, à ne relire que s'il a changé.

## Stack (validée le 2026-10-09)
Monorepo TypeScript (pnpm workspaces). Poste de dev : Windows 10, Node 24.
- `apps/api` — Node 24 + **Fastify**, **Socket.IO** (temps réel, une room par espace/joueur), **PostgreSQL** + **Drizzle ORM** (dev/tests : **PGlite** embarqué, pas de Docker), **Zod** pour valider les intentions client, **Vitest**.
- `packages/engine` — moteur de règles **pur** (sans I/O) : tirage, vérifs de scan, formules dynamiques, classement. Toute aléa passe par un RNG injecté (tests déterministes, simulation de calibrage).
- `packages/shared` — types, schémas Zod, constantes partagées api ↔ fronts.
- `apps/player` — PWA React + Vite (caméra QR, géolocalisation, licence QR tournante).
- `apps/staff` — console PNJ / GM (React + Vite).
- `apps/tracker` — écran géant, lecture seule (React + Vite).

Ordre de construction : engine → api → player → staff → tracker.

Commandes (racine) : `pnpm test` · `pnpm typecheck` · `pnpm --filter @gq/engine test`.
Packages internes : `@gq/engine`, `@gq/shared` (exportent `src/index.ts` directement, pas de build).

## Règles d'architecture (non négociables)
- **Serveur autoritaire (P1)** : le client envoie des intentions (« j'ai scanné la balise X »), jamais des résultats.
- Chaque règle implémentée cite son id en commentaire (`// RG-7.1`) et a au moins un test nommé avec l'id.
- Toute action d'état passe par une transaction et écrit une ligne de **Journal** (acteur, action, résultat, motif si PNJ/GM).
- Les paramètres dynamiques (RG-14) sont lus via un service unique qui résout Auto / Verrouillé / Multiplicateur ; pas de constante en dur dans le code métier.
- Positions exactes jamais envoyées aux joueurs ni au tracker (RG-10.12).
- Horloge injectée (pause RG-4.4 suspend les compteurs) : ne pas utiliser `Date.now()` directement dans l'engine.

## Conventions
- Messages de refus au joueur en clair et en français (RG-7.4).
- Commits en français, petits, un sujet par commit.
- Fin de chaque tâche : mettre à jour `docs/PROGRESS.md` (fait / prochaine étape / décisions).
