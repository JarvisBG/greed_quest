# Mise en ligne (gratuite)

**En ligne depuis le 2026-10-18** (Supabase `greed-island`, Render `greed-island-api` via le Blueprint `greed-island`, Cloudflare : 4 Workers statiques).

Tout est gratuit, rien à acheter. Trois services :

| Partie | Où | Adresse obtenue |
|---|---|---|
| Base de données | **Supabase** (comme Otaku Quest) | — |
| Serveur du jeu (API, temps réel, tâches) | **Render**, offre gratuite, Francfort | https://greed-island-api.onrender.com |
| Page d'accueil (vitrine, accès aux 3 apps) | **Cloudflare** | https://greed-island.jarvismboummeu28.workers.dev (`?ouverture` rejoue l'ouverture) |
| App joueur, console, écran géant | **Cloudflare** (comme Otaku Quest) | https://greed-island-joueur.jarvismboummeu28.workers.dev, https://greed-island-console.jarvismboummeu28.workers.dev, https://greed-island-ecran.jarvismboummeu28.workers.dev |

Pourquoi pas Supabase seul : les règles du jeu tournent dans un serveur Node (`apps/api`) qui doit rester allumé
(tâches planifiées, Socket.IO). Supabase garde les données, Render fait tourner le serveur.

## Limites des offres gratuites
- **Render s'endort** après 15 min sans visite ; le premier qui ouvre l'app attend ~1 min. La console et l'écran
  géant le gardent éveillé tant qu'ils sont ouverts (appel à `/sante` toutes les 10 min). Ouvrir la console
  quelques minutes avant la partie. 750 h gratuites par mois : un seul service gratuit allumé en continu.
- **Supabase se met en pause** après 7 jours sans activité : la relancer depuis supabase.com (bouton « Restore »).
- **Un seul serveur** : ne jamais lancer deux copies de l'API (tâches et temps réel en mémoire).

## 1. Supabase (base de données)
1. supabase.com → **New project** : nom `greed-island`, région **Central EU (Frankfurt)** (comme Render),
   mot de passe de la base : en choisir un et le garder.
2. Une fois créé : bouton **Connect** → onglet de la chaîne de connexion → **Session pooler**
   (Render ne parle pas l'IPv6 de la connexion directe). Copier la chaîne `postgresql://postgres.xxxx:[YOUR-PASSWORD]@…pooler.supabase.com:5432/postgres`
   et remplacer `[YOUR-PASSWORD]` par le mot de passe. Ne rien ajouter derrière (pas de `?sslmode`).
   Les tables se créent toutes seules au premier démarrage de l'API (migrations Drizzle).

## 2. Render (serveur du jeu)
1. render.com → se connecter **avec GitHub**, autoriser l'accès au dépôt `greed_quest`.
2. **New → Blueprint** → choisir `greed_quest` : Render lit `render.yaml` (branche `refonte-joueur`).
3. Remplir : `DATABASE_URL` = la chaîne Supabase ; `GQ_ADMIN_CODE` = un code d'organisateur (pour créer une
   partie) ; `CORS_ORIGINS` = laisser vide pour l'instant. `GQ_SECRET` est tiré au hasard par Render.
4. **Apply**. Attendre « Live », puis ouvrir `https://<adresse>/sante` → `{"ok":true}`.

## 3. Cloudflare (les 3 apps)
Depuis ce PC (wrangler y est déjà connecté au compte Cloudflare d'Otaku Quest) :

```
node scripts/fronts-en-ligne.mjs https://<adresse Render>
```

Construit les 3 apps avec l'adresse de l'API et les envoie (`apps/*/wrangler.jsonc`). Une seule :
`node scripts/fronts-en-ligne.mjs https://<adresse Render> player`.
Si wrangler demande de se connecter : `pnpm exec wrangler login`.

## 4. Finir
1. Render → service → **Environment** : `CORS_ORIGINS` = les 3 adresses Cloudflare, séparées par des virgules.
2. Console → lien « Organisateur » → créer la partie avec `GQ_ADMIN_CODE`.
3. Console → Planche QR : « adresse de l'app joueur » = l'adresse Cloudflare du joueur (QR-liens).
4. Écran géant : `https://greed-island-ecran.<compte>.workers.dev/?partie=<id>`.

L'adresse de l'app joueur est imprimée dans les QR : en changer (vrai nom de domaine) oblige à réimprimer.
Pour la vraie partie, si loJIC veut plus solide (pas de sommeil, sauvegardes), passer Render et Supabase en payant.

## Mettre à jour
- Serveur : chaque push sur `refonte-joueur` est remis en ligne par Render.
- Apps : relancer `node scripts/fronts-en-ligne.mjs https://<adresse Render>`.
