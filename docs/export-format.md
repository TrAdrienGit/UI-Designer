# Formats de fichiers

## Export HTML (`.html`)

Un **fichier unique et autonome** : images, vidéos et dessins importés intégrés en data URL (seuls les
médias donnés par URL restent externes). Il est
pensé pour être lu par un humain comme par une IA qui doit reproduire ou intégrer l'interface.

Structure, dans l'ordre :

1. `<head>` avec `charset`, `viewport`, `<meta name="generator" content="UI Designer x.y.z">` et le titre
   (nom du document).
2. **Commentaire de synthèse** (`UI DESIGNER EXPORT`) :
   - taille et fond du canevas (`transparent (overlay / HUD)` le cas échéant) ;
   - taille de l'écran (`Screen`) et mention du défilement si la page est plus haute ;
   - convention de positionnement, explication des éléments fixes, des liens et des dessins s'il y en a ;
   - **arbre des éléments**, une ligne par élément, indenté selon l'imbrication :
     `#id  type <balise>  x,y  largeur x hauteur  contenu  -> lien  [drapeaux]` ; drapeaux possibles :
     `hidden`, `fixed`, `onclick`, `guide, not exported`.
3. `<style>` :
   - règles de page (`html` avec `scroll-behavior: smooth`, `body`, `#uid-canvas` à la taille de la
     page, avec son image de fond éventuelle) ;
   - styles partagés `uid-*` (cases, interrupteurs, barres de progression…) ;
   - **une règle par élément**, sélecteur `#id`, en commençant toujours par
     `position: absolute; left; top; width; height` (ou `position: fixed` pour un élément fixe).
4. `<body>` : `<div id="uid-canvas" class="uid-root">` puis les éléments imbriqués comme dans le
   panneau Calques (l'ordre du code = ordre d'empilement, le dernier est au-dessus).
5. `<script>` uniquement si au moins un élément a un script « au clic » : un
   `addEventListener('click', function (event) { … })` par élément.

### Conventions

| Sujet | Règle |
| --- | --- |
| Identifiants | Nom de l'élément converti en identifiant (`Bouton Jouer` → `bouton-jouer`), rendu unique (`-2`, `-3`…). `uid-canvas` est réservé. |
| Classes | `uid-<type>` sur chaque élément + les classes CSS saisies par l'utilisateur. |
| Positions | En pixels, relatives à la boîte intérieure (dans la bordure) du parent. `box-sizing: border-box` partout. |
| Éléments masqués | Présents avec l'attribut `hidden` (utile pour des états de HUD affichés en JS). |
| Images | `<img>` avec data URL (ou URL) ; sans image choisie, un bloc `uid-placeholder` « Image ». |
| Éléments fixes | `position: fixed; z-index: 100`, `left` / `top` en coordonnées de page (le canevas commence en haut à gauche). Leurs enfants restent en `absolute` dedans. |
| Liens | `href` (+ `target="_blank" rel="noopener"` pour un nouvel onglet). `#id` vise l'identifiant exporté d'un élément. |
| Fonds | `background-image: url(…)` + `background-size` / `-position` / `-repeat` selon l'ajustement. |
| Dessins | `div.uid-drawing` > `img` PNG ; les calques « guide » ne sont pas exportés. |

### Correspondance des types

| Type | Balise exportée |
| --- | --- |
| `container` | `div`, `header`, `nav`, `main`, `section`, `article`, `aside`, `footer` (au choix) ; `a` si lien |
| `text` | `p`, `span`, `label`, `h1`…`h4` (au choix) ; texte dans `a.uid-link` si lien |
| `button` | `button type="button"` ; `a role=button` si lien |
| `input` | `input` (`text`, `password`, `email`, `number`, `search`) |
| `textarea` | `textarea` |
| `checkbox`, `radio` | `label.uid-check` > `input` + `span` |
| `toggle` | `label.uid-check.uid-toggle` > `input type=checkbox` + piste stylée |
| `select` | `select` > `option` |
| `list` | `ul` ou `ol` > `li` |
| `image` | `img` ; `a` > `img.uid-media` si lien |
| `video` | `video` (`controls`, `autoplay`, `loop`, `muted`, `playsinline`) |
| `drawing` | `div.uid-drawing` > `img` (PNG dessiné à la main) |
| `progress` | `div role=progressbar` > `div.uid-progress-fill` (largeur en %) |
| `slider` | `input type=range` |
| `divider` | `div role=separator` |

## Projet (`.uidesign`)

JSON indenté, lisible et versionnable :

```json
{
  "format": "ui-designer-project",
  "version": 2,
  "name": "Mon HUD",
  "canvas": {
    "width": 480, "height": 270, "viewportHeight": 270, "background": "#ffffff",
    "backgroundImage": "", "backgroundFit": "cover", "transparent": true
  },
  "grid": { "size": 10, "visible": true, "snap": true },
  "elements": [
    {
      "id": "el_x1y2", "type": "container", "name": "panneau",
      "x": 10, "y": 10, "width": 200, "height": 80,
      "hidden": false, "locked": false, "fixed": false, "cssClass": "",
      "style": { "background": "#f5f7fa", "borderWidth": 1, "...": "..." },
      "props": { "text": "", "items": [], "...": "..." },
      "children": []
    }
  ]
}
```

- `version` est le numéro du format ; un fichier d'une version plus récente est refusé avec un
  message clair.
- Format 2 (version 0.2.0) : `canvas.viewportHeight`, image de fond (page et éléments), `fixed`,
  liens (`props.href`, `props.newTab`), balise de boîte (`props.boxTag`), types `video` et `drawing`.
  Un fichier au format 1 s'ouvre avec une hauteur d'écran égale à la hauteur de page.
- À la lecture, les champs manquants prennent leur valeur par défaut, les valeurs de mauvais type et
  les types d'éléments inconnus sont ignorés, les identifiants en double sont régénérés : un fichier
  modifié à la main ou par une IA reste ouvrable.
