# UI Designer

Logiciel de bureau (Windows, hors ligne) pour **dessiner des interfaces web et des HUD** comme dans un
éditeur d'images : on choisit un outil dans la boîte à outils, on trace des boîtes, des boutons, des
listes, des cases à cocher… on les déplace et on les imbrique sur une grille aimantée, et l'outil
génère en direct **un fichier HTML unique** (HTML + CSS + JS intégrés) prêt à être réutilisé, y compris
par une IA.

![Statut](https://img.shields.io/badge/statut-0.1.0-blue)

## Fonctionnalités

- **Boîte à outils** façon Paint.NET : sélection, main, zoom, boîte, séparateur, texte, liste, bouton,
  champ texte, zone de texte, case à cocher, bouton radio, interrupteur, liste déroulante, curseur,
  barre de progression, image.
- **Canevas** avec grille, aimantation, zoom (Ctrl + molette), défilement (Espace + glisser).
- **Imbrication** : déposer un élément sur une boîte le range dedans (Alt pour l'empêcher) ;
  grouper / dégrouper (Ctrl+G / Ctrl+Maj+G).
- **Poignées** de redimensionnement (Maj = garder les proportions), flèches pour déplacer au pixel.
- **Aligner / répartir**, ordre d'empilement, verrouiller, masquer.
- **Panneau Propriétés** : position, taille, contenu, couleurs, bordure, arrondi, police, ombre,
  CSS supplémentaire, script « au clic ».
- **Panneau Calques** : arbre des éléments, glisser-déposer pour réordonner ou ranger dans une boîte,
  double-clic pour renommer.
- **Annuler / rétablir** illimité (200 étapes), copier / coller / dupliquer.
- Onglets **Conception / Aperçu / Code** : aperçu interactif du fichier exporté et code source en direct.
- **Formats prédéfinis** : bureau, Full HD, mobile, tablette, HUD Minecraft (échelles GUI 2/3/4),
  fenêtres d'inventaire Minecraft ; fond transparent pour les overlays.
- **Projets** `.uidesign` (JSON lisible) et **export HTML autonome** : images intégrées en data URL,
  aucune ressource externe, en-tête qui décrit la mise en page et l'arbre des éléments pour les IA.
- Journalisation dans des fichiers (une session = un fichier, rotation automatique).

## Démarrer

Prérequis : [Node.js](https://nodejs.org/) 22 ou plus récent.

```bash
npm install
npm start
```

`npm start` compile puis ouvre la fenêtre de l'application.

Créer l'installeur et la version portable Windows (dans `release/`) :

```bash
npm run dist
```

## Le fichier exporté

Un seul fichier `.html` : une `<style>` avec une règle par élément (sélecteur `#id`), le balisage
imbriqué, et un `<script>` seulement si un élément a une action au clic. Le commentaire d'en-tête
résume le canevas, la convention de positionnement et l'arbre complet :

```text
Element tree  (#id  type  x,y  width x height  "content")
#panneau  container  100,100  400x300
  #bouton-jouer  button  10,20  100x30  "Jouer"  [onclick]
```

Détails : [docs/export-format.md](docs/export-format.md).

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/user-guide.md](docs/user-guide.md) | Outils, raccourcis, cas d'usage (pages, HUD Minecraft) |
| [docs/export-format.md](docs/export-format.md) | Format du HTML exporté et du projet `.uidesign` |
| [docs/architecture.md](docs/architecture.md) | Architecture en couches, flux de données, choix techniques |
| [docs/development.md](docs/development.md) | Compilation, tests, logs, débogage, publication |
| [CHANGELOG.md](CHANGELOG.md) | Historique des versions |

## Technologies

Electron, TypeScript (sans framework d'interface), esbuild, Vitest, electron-builder.
