# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Joueurs** : fans de *Hunter × Hunter* de 16 à 30 ans, téléphones récents, habitués aux jeux mobiles. Ils jouent dehors, **en plein jour, souvent au soleil**, en marchant, téléphone tenu d'une main, pendant une partie de 90 à 180 min (120 par défaut). Leur geste répété : scanner une balise QR, regarder ce qu'ils ont tiré, ranger la carte dans leur Livre, viser un joueur proche avec un sort.
- **PNJ** (arbitres) : debout sur le terrain, téléphone, scannent la licence QR d'un joueur pour un checkpoint, une enchère, l'arène, une expertise, une sanction.
- **Game Master** : sur ordinateur portable ou tablette, prépare la partie (zones, balises, catalogue, paramètres), puis la pilote en direct (cycle de vie, évènements, alertes anti-triche, Clear).
- **Public et joueurs devant l'écran géant** : un téléviseur ou un vidéoprojecteur lu à 5-10 m, sans interaction.

## Product Purpose
Greed Quest transpose le jeu *Greed Island* (arc de *Hunter × Hunter*) en chasse au trésor physique : balises QR posées dans un lieu réel, Livre de cartes numérotées à compléter, sorts entre joueurs proches (GPS), échanges, enchères, arène, évènements lancés par le GM. Réussir : un fan se sent dans Greed Island, et la partie reste lisible et juste sur le terrain. Client : loJIC Solutions.

## Positioning
Ce n'est pas un jeu de géolocalisation générique : c'est le jeu de l'anime rendu réel, avec ses objets (le Book, les cartes à rang, la licence de Hunter, le Nen) et sa règle « serveur autoritaire » : tout résultat vient du serveur, l'interface montre et demande.

## Operating Context
- Trois applications web (React) : app joueur (PWA, caméra, GPS, hors ligne partiel), console PNJ / GM, écran géant.
- Supports physiques : balises QR imprimées, QR des lieux (Masadora, Antokiba, Soufrabi), QR d'accueil.
- Partie en direct : chrono, pause, phase finale, temps réel Socket.IO.

## Capabilities and Constraints
- Périmètre écran par écran : `docs/PROMPT_INTERFACES.md` § 4. Règles : `docs/REGLES.md`.
- Langue : français uniquement ; le joueur est tutoyé ; l'équipe lit des libellés neutres à l'infinitif.
- Les refus de l'API arrivent rédigés en français et s'affichent tels quels.
- Positions exactes jamais montrées aux joueurs ni à l'écran géant (RG-10.12).
- Vocabulaire du jeu employé tel quel : Book, Clear, Hunter, Nen, Zetsu, jenny, rangs SS à D.

## Brand Commitments
- Nom de l'app : **Greed Quest**.
- Habillage **Hunter × Hunter / Greed Island pleinement assumé** (décision du 2026-10-10) : Book, cartes à rang, voix du jeu, licence de Hunter, hexagone du Nen, villes de Greed Island. Droits sur l'œuvre à la charge du client.
- **Écriture Hunter** (police de fan) autorisée en décor seulement, toujours doublée en français.
- Aucun « marqueur IA » (liste dans `docs/PROMPT_INTERFACES.md` § 2.2).

## Evidence on Hand
- Aucun logo, aucune image, aucune police fournis. Tout est à dessiner (SVG / CSS), sauf la police de fan de l'écriture Hunter, à télécharger.
- Partie de démonstration (seed API) : 30 cartes nommées, 6 zones, 20 balises ; aucune donnée réelle de partie.

## Product Principles
1. Lisible en marchant au soleil avant d'être beau.
2. Le Book et la carte sont le cœur : tout le reste les sert.
3. Le serveur décide, l'interface montre la vérité qu'elle reçoit, rien d'inventé.
4. Un fan reconnaît Greed Island ; un non-fan comprend quand même.

## Accessibility & Inclusion
- Contraste AA partout, AAA pour les chiffres clés (chrono, jenny, numéros de carte) : usage en plein soleil.
- Cibles tactiles ≥ 48 px ; usage à une main.
- Rang lisible sans la couleur (lettre).
- `prefers-reduced-motion` respecté.
