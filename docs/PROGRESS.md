# Progression

## État actuel
**Phase 0 — Cadrage** (9 oct. 2026)
- [x] Lecture du document de règles, résumé dans `docs/REGLES.md`
- [x] `CLAUDE.md` créé
- [x] Stack validée (CLAUDE.md)
- [x] Environnement vérifié : Node 24.21, npm 11.19, git 2.55, corepack 0.36. **Absents** : pnpm, PostgreSQL, Docker.
- [x] pnpm 10.34 installé via `npm i -g pnpm` (corepack exige les droits admin : EPERM)
- [x] `git init` (branche `main`) + monorepo : `packages/engine`, `packages/shared` ; TS 7, Vitest 5, Zod 4 ; `pnpm typecheck` et `pnpm test` OK

**Prochaine étape** : Phase 1 — engine : formules RG-14, puis tirage RG-8.3 (RNG injecté).

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
- 2026-10-09 — Pas de Docker. Dev et tests : PGlite (PostgreSQL embarqué, zéro installation) via Drizzle ; prod : PostgreSQL hébergé. Raison : rien à installer sur le poste Windows, même dialecte SQL qu'en prod.

## Points ouverts (repris du document de règles)
- Nom / habillage · Clear = fin de partie ou phase finale ? · Compte joueur persistant ? · Pouvoirs de Spécialisation, contenu Examen et test de Nen · Portée 30 m · Calibrage.
