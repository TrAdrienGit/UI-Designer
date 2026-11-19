# Formats de fichiers

## Export HTML (`.html`)

Un **fichier unique et autonome** : pas de ressource externe, images intégrées en data URL. Il est
pensé pour être lu par un humain comme par une IA qui doit reproduire ou intégrer l'interface.

Structure, dans l'ordre :

1. `<head>` avec `charset`, `viewport`, `<meta name="generator" content="UI Designer x.y.z">` et le titre
   (nom du document).
2. **Commentaire de synthèse** (`UI DESIGNER EXPORT`) :
   - taille et fond du canevas (`transparent (overlay / HUD)` le cas échéant) ;
   - convention de positionnement ;
   - **arbre des éléments**, une ligne par élément, indenté selon l'imbrication :
     `#id  type  x,y  largeur x hauteur  contenu  [drapeaux]` ; drapeaux possibles : `hidden`, `onclick`.
3. `<style>` :
   - règles de page (`html`, `body`, `#uid-canvas` à la taille du canevas) ;
   - styles partagés `uid-*` (cases, interrupteurs, barres de progression…) ;
   - **une règle par élément**, sélecteur `#id`, en commençant toujours par
     `position: absolute; left; top; width; height`.
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
| Images | `<img>` avec data URL ; sans image choisie, un bloc `uid-placeholder` « Image ». |

### Correspondance des types

| Type | Balise exportée |
| --- | --- |
| `container` | `div` |
| `text` | `p`, `span`, `label`, `h1`…`h4` (au choix) |
| `button` | `button type="button"` |
| `input` | `input` (`text`, `password`, `email`, `number`, `search`) |
| `textarea` | `textarea` |
| `checkbox`, `radio` | `label.uid-check` > `input` + `span` |
| `toggle` | `label.uid-check.uid-toggle` > `input type=checkbox` + piste stylée |
| `select` | `select` > `option` |
| `list` | `ul` ou `ol` > `li` |
| `image` | `img` |
| `progress` | `div role=progressbar` > `div.uid-progress-fill` (largeur en %) |
| `slider` | `input type=range` |
| `divider` | `div role=separator` |

## Projet (`.uidesign`)

JSON indenté, lisible et versionnable :

```json
{
  "format": "ui-designer-project",
  "version": 1,
  "name": "Mon HUD",
  "canvas": { "width": 480, "height": 270, "background": "#ffffff", "transparent": true },
  "grid": { "size": 10, "visible": true, "snap": true },
  "elements": [
    {
      "id": "el_x1y2", "type": "container", "name": "panneau",
      "x": 10, "y": 10, "width": 200, "height": 80,
      "hidden": false, "locked": false, "cssClass": "",
      "style": { "background": "#f5f7fa", "borderWidth": 1, "...": "..." },
      "props": { "text": "", "items": [], "...": "..." },
      "children": []
    }
  ]
}
```

- `version` est le numéro du format ; un fichier d'une version plus récente est refusé avec un
  message clair.
- À la lecture, les champs manquants prennent leur valeur par défaut, les valeurs de mauvais type et
  les types d'éléments inconnus sont ignorés, les identifiants en double sont régénérés : un fichier
  modifié à la main ou par une IA reste ouvrable.
