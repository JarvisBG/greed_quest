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

**Phase 1 — Moteur** (en cours) : tâches 1.1 → 1.5 faites (types, RNG, paramètres RG-14, lissage J, tirage RG-8.3). 25 tests verts.

**Prochaine étape** : 1.6 Livre RG-8.5, puis 1.7 vérifications de scan RG-7.

## Ambiguïtés du document (valeurs provisoires dans le code, à valider)
- RG-6 vs tableau RG-8 : balise standard « rangs D à A » mais le tableau donne 1 % de S en standard → S exclu en standard (`draw.ts`).
- Poids des rangs en balise rare (« poids relevés ») non chiffrés → S 15, A 25, B 30, C 30.
- Balise fantôme : SS 50 / S 50, et toujours une carte (ni sort ni jenny).
- Montant d'un gain jenny non fixé → 10 J. Répartition des sorts tirés → uniforme ; « sort de rareté commune » (RG-5.5) : rareté des sorts non définie.
- RG-7.2 : un rang au-dessus du plafond est ramené au plafond (et non retiré puis renormalisé).
- RG-8.3 : si le rang tiré et tous les rangs inférieurs sont épuisés → jenny, même si un rang supérieur reste dispo.
- RG-14.1 « baisse limitée à un palier toutes les 10 min » : interprété comme une baisse appliquée au plus une fois par fenêtre de 10 min.
- RG-14.2 multiplicateur : arrondi à l'entier le plus proche.
- RG-14.5 : contenu des préréglages Petit groupe / Grande foule non défini.

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
