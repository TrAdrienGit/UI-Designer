# Guide d'utilisation

## L'écran

- **Barre du haut** : fichiers, annuler/rétablir, onglets Conception / Aperçu / Code, alignements,
  grouper, ordre, supprimer, grille, aimantation, zoom.
- **Boîte à outils** (gauche) : un outil actif à la fois, comme dans un éditeur d'images.
- **Canevas** (centre) : la page ou le HUD à dessiner.
- **Propriétés** (droite, haut) : réglages du document si rien n'est sélectionné, sinon de l'élément.
- **Calques** (droite, bas) : l'arbre des éléments, le plus haut en premier.
- **Barre d'état** : outil, position du curseur, sélection, taille du canevas, fichier.

## Dessiner

1. Choisir un outil (clic ou touche : `R` boîte, `T` texte, `B` bouton…).
2. Cliquer-glisser sur le canevas pour tracer l'élément, ou simple clic pour sa taille par défaut.
3. L'outil repasse en **Sélection** ; maintenir **Ctrl** en relâchant garde l'outil pour en tracer
   plusieurs.

L'élément est créé dans la **boîte la plus profonde** sous le point de départ. `Maj` trace un carré.

## Sélectionner, déplacer, redimensionner

- Clic : sélectionne l'élément le plus profond. Clic sur un enfant d'une boîte déjà sélectionnée :
  glisser déplace la boîte, simple clic sélectionne l'enfant.
- `Échap` remonte au parent, puis désélectionne. `Ctrl`/`Maj` + clic ajoute ou retire.
- Glisser dans le vide : rectangle de sélection.
- Déposer un élément sur une boîte le range dedans (cadre vert) ; `Alt` garde le parent actuel.
- Poignées : redimensionner ; `Maj` garde les proportions.
- Flèches : 1 px ; `Maj` + flèches : un pas de grille.
- Double-clic : place le curseur dans le texte de l'élément (panneau Propriétés).

## Raccourcis

| Raccourci | Action |
| --- | --- |
| `V` `H` `Z` | Sélection, main, zoom (`Alt` + clic : dézoomer) |
| `R` `T` `L` `B` `I` `E` | Boîte, texte, liste, bouton, champ texte, zone de texte |
| `C` `O` `K` `D` `S` `P` `G` | Case, radio, interrupteur, liste déroulante, curseur, progression, image |
| `Ctrl+N` `Ctrl+O` `Ctrl+S` `Ctrl+Maj+S` | Nouveau, ouvrir, enregistrer, enregistrer sous |
| `Ctrl+E` | Exporter en HTML |
| `Ctrl+Z` `Ctrl+Y` | Annuler, rétablir |
| `Ctrl+X` `Ctrl+C` `Ctrl+V` `Ctrl+D` | Couper, copier, coller (dans la boîte sélectionnée), dupliquer |
| `Suppr` | Supprimer |
| `Ctrl+A` | Tout sélectionner (au même niveau) |
| `Ctrl+G` `Ctrl+Maj+G` | Grouper dans une boîte, dégrouper |
| `Ctrl+]` `Ctrl+[` (+`Maj`) | Avancer, reculer (premier plan, arrière-plan) |
| `Ctrl+L` `Ctrl+H` | Verrouiller, masquer |
| `F5` `F6` `F7` | Conception, Aperçu, Code |
| `Ctrl+=` `Ctrl+-` `Ctrl+0` `Ctrl+B` | Zoom avant, arrière, 100 %, ajuster |
| `Ctrl+molette` / `Espace`+glisser | Zoom sur le curseur / défiler |
| `Ctrl+'` `Ctrl+Maj+'` | Grille, aimantation |
| `F1` | Liste complète des raccourcis |

## Créer un HUD Minecraft

1. Sans sélection, panneau **Canevas → Format** : choisir « Minecraft HUD, échelle GUI 4 (480 × 270) »
   (ou 2 / 3). Le fond devient transparent (damier).
2. Mettre la grille à 2 ou 4 px pour un rendu « pixel ».
3. Dessiner barres de progression (vie, faim, XP), textes et images (icônes intégrées au fichier).
4. Police : `Minecraft, monospace` si la police est installée.
5. Exporter : l'en-tête du fichier donne les positions exactes de chaque élément, directement
   transposables dans du code de mod (multiplier par l'échelle GUI pour obtenir des pixels écran).

Les formats « fenêtre d'inventaire (176 × 166) » et « grand coffre (176 × 222) » reprennent la taille
des textures de conteneurs vanilla.

## Fichiers

- **Projet** `.uidesign` : à garder pour continuer à modifier le design.
- **Export** `.html` : le résultat, autonome. L'onglet **Code** montre exactement ce fichier, avec un
  bouton **Copier** pour le coller dans une conversation avec une IA.
- Fermer avec des modifications non enregistrées demande confirmation.
