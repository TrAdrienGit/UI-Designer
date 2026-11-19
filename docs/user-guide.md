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

### Régions de page : en-tête, contenu principal, section, pied de page

Ces outils créent des boîtes avec la bonne balise HTML (`header`, `main`, `section`, `footer`).
Un **simple clic** les place sur **toute la largeur** de la page (ou de la boîte cliquée) : l'en-tête
en haut, le pied de page en bas, le contenu principal et la section à la hauteur du clic. Un
cliquer-glisser les trace librement. Toute boîte peut changer de balise (Propriétés → Contenu →
Balise : div, header, nav, main, section, article, aside, footer).

## Page qui défile

- Sans sélection, panneau **Page** : **Hauteur** = toute la page, **Écran** = la partie visible.
  Une page plus haute que l'écran défile.
- Allonger la page : tirer la **poignée sous la page** (ou à droite / dans le coin), ou le bouton
  **+ 1 écran**. Une ligne rouge pointillée marque le **bas de l'écran**.
- **Fixe à l'écran** (Propriétés → Élément) : l'élément reste en place quand la page défile (en-tête
  collant, bouton flottant…). Une pastille violette 📌 le signale sur le canevas. Ses enfants bougent
  avec lui. Les éléments fixes passent au-dessus du contenu qui défile.
- L'onglet **Aperçu** montre la page à la taille de l'écran : faire défiler pour tester.

## Images, vidéos, fonds

- **Image** (`G`) : **Choisir une image…** l'intègre au fichier ; ou une **URL** (lien externe).
- **Vidéo** (`M`) : **Importer une vidéo…** (MP4, WebM, Ogg ; 64 Mo max., intégrée au fichier) ou une
  URL. Options : contrôles, lecture automatique (seulement si muette), en boucle, muet. La vidéo ne joue
  pas dans la vue Conception, seulement dans l'Aperçu.
- **Image de fond** : toute boîte (Propriétés → Apparence → Image fond) et la page elle-même (panneau
  Page) peuvent avoir une image de fond : couvrir, contenir, étirer, mosaïque ou taille réelle, avec sa
  position.

## Liens

Textes, boutons, images et boîtes ont une section **Lien** : adresse web (`https://…`), autre page
(`page.html`), **ancre** vers un élément de la page (`#id`, proposé dans la liste : la page défile
jusqu'à lui) ou `mailto:`. Option « Ouvrir dans un nouvel onglet ». Une pastille verte signale les
liens sur le canevas. Dans l'Aperçu, les ancres font défiler la page et les liens web s'ouvrent dans le
navigateur.

## Dessiner à main levée

Le groupe **Dessin** de la boîte à outils transforme la page en image à peindre, pour faire une
maquette à la main par-dessus (ou à la place) des éléments :

| Outil | Touche | Effet |
| --- | --- | --- |
| Calque de dessin | `Y` | Trace une zone de dessin transparente (un calque) |
| Crayon | `N` | Trait net au pixel près |
| Pinceau | `U` | Trait lissé |
| Gomme | `W` | Efface le dessin (jamais les éléments) |
| Pot de peinture | `F` | Remplit une zone de même couleur (tolérance réglable) |
| Ligne, rectangle, ellipse | `Maj+L` `Maj+R` `Maj+E` | Formes ; `Maj` en traçant : 45°, carré, cercle |
| Pipette | `Maj+I` | Prend une couleur |

- **Couleurs** en bas de la boîte à outils : clic gauche = couleur principale, clic droit = couleur
  secondaire ; `X` les inverse. La barre d'options (en haut du canevas) règle la taille, le mode des
  formes (contour, plein, contour + fond) et la tolérance du pot. `[` et `]` changent la taille.
- **Où va le dessin ?** Dans le calque de dessin sélectionné, sinon dans celui sous le curseur, sinon
  dans le **croquis de la page** (`sketch-1`), créé au premier trait : un calque transparent de la
  taille de la page, au-dessus des éléments. Les clics de sélection traversent les calques de dessin
  (on peut toujours sélectionner les boîtes dessous).
- Chaque trait = une étape d'annulation (`Ctrl+Z`).
- Un calque peut être **guide seulement** : visible pendant la conception, absent de l'export (pour
  décalquer une capture d'écran importée avec **Importer une image…**).

### Du croquis à la page

L'export garde les dessins comme images PNG et les annonce dans son en-tête. Un croquis fait main peut
donc être donné tel quel à une IA (« transforme ce croquis en vraie page HTML ») ; l'outil, lui, ne
convertit pas automatiquement un dessin en éléments (il faudrait un modèle de vision, et le logiciel
reste hors ligne). Méthode conseillée : dessiner le croquis, puis tracer les vraies boîtes par-dessus
en s'en servant de guide, et passer le croquis en « guide seulement ».

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
| `C` `O` `K` `D` `S` `P` `G` `M` | Case, radio, interrupteur, liste déroulante, curseur, progression, image, vidéo |
| `Y` `N` `U` `W` `F` | Calque de dessin, crayon, pinceau, gomme, pot de peinture |
| `Maj+L` `Maj+R` `Maj+E` `Maj+I` | Ligne, rectangle, ellipse, pipette |
| `X` / `[` `]` | Inverser les couleurs de dessin / taille du trait |
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

1. Sans sélection, panneau **Page → Format** : choisir « Minecraft HUD, échelle GUI 4 (480 × 270) »
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
