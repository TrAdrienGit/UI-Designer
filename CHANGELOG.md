# Historique des versions

## 0.2.0 — 2026-11-19

- **Régions de page** : outils En-tête, Contenu principal, Section, Pied de page (balises `header`,
  `main`, `section`, `footer`) ; un clic les place sur toute la largeur. Balise au choix pour toute
  boîte (div, header, nav, main, section, article, aside, footer).
- **Page qui défile** : hauteur de page et hauteur d'écran distinctes, poignées pour agrandir la page,
  bouton « + 1 écran », ligne de bas d'écran ; l'Aperçu a la taille de l'écran et défile.
- **Éléments fixes à l'écran** (`position: fixed`) : en-têtes collants, boutons flottants ; pastille
  sur le canevas.
- **Liens** sur textes, boutons, images et boîtes : URL, ancre `#id` (défilement doux), mailto,
  nouvel onglet ; liens actifs dans l'Aperçu (ouverts dans le navigateur).
- **Vidéos** : nouvel élément Vidéo (fichier intégré jusqu'à 64 Mo ou URL ; contrôles, lecture auto,
  boucle, muet).
- **Images de fond** sur les boîtes et la page (couvrir, contenir, étirer, mosaïque, position) ;
  images et vidéos acceptent aussi une URL.
- **Dessin à main levée** : calques de dessin, crayon au pixel, pinceau, gomme, pot de peinture avec
  tolérance, ligne, rectangle, ellipse, pipette, couleurs principale / secondaire ; croquis de page
  créé au premier trait ; calques « guide » non exportés ; dessins exportés en PNG et décrits pour
  les IA.
- Boîte à outils sur deux colonnes ; les clics de sélection traversent les calques de dessin.
- Format de projet 2 (les projets 0.1 s'ouvrent toujours).
- Licence domaine public (The Unlicense), icône, installeur Windows (NSIS) et version portable,
  AppImage Linux et workflow de release GitHub Actions sur tag `vX.Y.Z`.
- 101 tests unitaires.

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
