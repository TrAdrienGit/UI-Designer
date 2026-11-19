# Historique des versions

## Non publié

- Licence domaine public (The Unlicense).
- Icône de l'application.
- Installeur Windows (NSIS) et version portable ; AppImage Linux construite par GitHub Actions.
- Workflow de release : un tag `vX.Y.Z` construit et publie les installeurs.

## 0.1.0 — 2026-11-19

Première version.

- Application de bureau Electron, entièrement hors ligne, architecture en couches
  (domain / application / infrastructure / presentation).
- Boîte à outils : sélection, main, zoom, boîte, séparateur, texte, liste, bouton, champ texte, zone de
  texte, case à cocher, radio, interrupteur, liste déroulante, curseur, barre de progression, image.
- Canevas avec grille aimantée, zoom, défilement, poignées de redimensionnement, rectangle de
  sélection, imbrication par glisser-déposer, menu contextuel.
- Aligner, répartir, grouper / dégrouper, ordre d'empilement, verrouiller, masquer.
- Panneaux Propriétés et Calques (renommage, visibilité, verrou, glisser-déposer dans l'arbre).
- Annuler / rétablir, copier / couper / coller / dupliquer.
- Vues Aperçu (iframe isolée, scripts actifs) et Code (fichier exporté, copie).
- Projets `.uidesign` (JSON) et export HTML autonome avec en-tête descriptif pour les IA.
- Formats prédéfinis web et Minecraft (HUD aux échelles GUI 2/3/4, fenêtres d'inventaire).
- Logs fichier par session avec rotation ; 79 tests unitaires.
