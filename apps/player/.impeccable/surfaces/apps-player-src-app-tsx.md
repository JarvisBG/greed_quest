---
version: 1
slug: "apps-player-src-app-tsx"
primary_target: "apps/player/src/App.tsx"
related_targets: []
---

# App joueur — pièces maîtresses

Scope : app joueur (`apps/player`), mode Operate. Premier livrable : prototype vivant des pièces maîtresses (carte, Book flottant et feuilletable, licence de Hunter, annonce du jeu, échelle des rangs), à valider sur téléphone avant la refonte écran par écran.

Audience : fans de Hunter × Hunter, dehors au soleil, téléphone à une main. Tâche : scanner, voir le tirage, ranger dans le Book, lancer un sort. Contraintes : lisible au soleil (fond clair décidé le 2026-10-10), cibles 48 px, pas d'animation en boucle infinie, `prefers-reduced-motion`.

Ce qui ferait dire « raté » (Sivraj) : pas assez anime, appli générique, trop chargé, animations molles.

## Direction contract

THESIS : l'app est une planche de Hunter × Hunter imprimée dans le Jump : encre pleine, trames, cases à bord épais ; le Book et les cartes de l'anime sont les seuls objets en couleur. Refuse l'appli de jeu en tuiles arrondies et le thème sombre plaqué.

EXCEPTION (Sivraj, 2026-10-10) : la révélation du Nen (divination par l'eau puis hexagone) est une cinématique plein écran, sombre et en couleur (pièce de Wing, aura de la couleur du type) ; c'est le seul écran sombre de l'app.

OWN-WORLD : papier journal froid presque blanc, encre noire pure, trames de points pour les ombres et les états, cases cernées 3 px avec gouttières blanches, une case inclinée par écran au plus ; lignes de vitesse pour les moments forts. Couleur réservée aux objets du jeu : cadre rouge (cartes désignées), bleu (sorts), jaune (objets), matières de rang SS → D. Annonces du jeu en boîte de dialogue de console (Joy Station) : aplat noir, double filet blanc, police pixel.

STORY : le fan reconnaît le Book, la carte et la licence au premier regard ; il comprend son état (chrono, jenny, cartes) en marchant ; chaque gain est un évènement de planche.

FIRST VIEWPORT : case du haut = chrono en gros chiffres d'encre, jenny, pastille ; grande case centrale = Book fermé qui flotte, bouton « Book » en aplat noir inversé en bas, à portée du pouce.

FORM : planche de manga (Jump), candidat 5 de la liste ordonnée, seed 19fec693. Relèvements : chiffres clés en encre pure (ikeda), perdu imprimé en gris tramé (goods), une seule action en aplat inversé par écran (timetable), grille des pochettes comme armature (crouwel). Signature : invocation du Book (apparition, lévitation bornée, ouverture, page tournée au doigt en 3D) ; carte tirée qui se retourne puis vole dans sa pochette.

FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
