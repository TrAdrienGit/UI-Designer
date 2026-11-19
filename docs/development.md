# Développement

## Mise en place

```bash
npm install
```

npm 11+ demande d'autoriser les scripts d'installation ; ceux d'`esbuild`, `electron` et
`electron-winstaller` sont déjà approuvés dans `package.json` (`allowScripts`). Si le binaire
d'Electron manque (`node_modules/electron/dist` absent) :

```bash
node node_modules/electron/install.js
```

## Scripts

| Commande | Effet |
| --- | --- |
| `npm start` | Compile (`dist/`) et lance l'application |
| `npm run build` | Compile seulement (développement, avec source maps) |
| `npm run typecheck` | Vérification TypeScript stricte |
| `npm test` | Tests unitaires (Vitest) |
| `npm run check` | Typecheck + tests |
| `npm run dist` | Build de production + installeur NSIS et version portable Windows dans `release/` |
| `npm run dist:linux` | AppImage Linux (uniquement sous Linux, sinon via GitHub Actions : voir [release.md](release.md)) |

`scripts/build.mjs` regroupe les trois points d'entrée avec esbuild (`src/main/main.ts`,
`src/preload/preload.ts`, `src/presentation/index.ts`) et copie `static/` dans `dist/renderer/`.

## Tests

Les tests sont dans `tests/`, rangés par couche (`domain`, `application`, `infrastructure`,
`presentation`). Ils couvrent le modèle, l'arbre, la géométrie, le mapping HTML, l'historique, les
transformations, le store, le service de fichiers, la sérialisation, l'export et les logs (sur un
dossier temporaire). `tests/helpers.ts` fournit des identifiants déterministes et un logger muet.

Règle : toute nouvelle logique du domaine ou de l'application arrive avec ses tests.

## Logs

- Un fichier par session : `ui-designer-AAAA-MM-JJ_hh-mm-ss.log`.
- Emplacement : `logs/` à la racine du projet en développement, `%APPDATA%/UI Designer/logs` une fois
  installé (menu **Aide → Ouvrir le dossier des logs**).
- Rotation au démarrage : 30 fichiers et 100 Mo maximum ; une session s'arrête d'écrire au-delà de
  20 Mo.
- Niveau : `debug` en développement, `info` en production ; forcer avec la variable
  `UI_DESIGNER_LOG_LEVEL=debug|info|warn|error`.
- Le renderer envoie ses logs au process principal par IPC (portée `renderer/...`) ; les erreurs non
  capturées des deux côtés sont journalisées.

Format : `2026-11-19 14:03:22.123 INFO  [renderer/store] Ajouter bouton {"id":"…"}`.

## Débogage

- **Affichage → Outils de développement** (hors version installée).
- Interface dans un navigateur ordinaire, sans Electron (adaptateurs de secours : téléchargements au
  lieu des dialogues natifs) :

  ```bash
  npm run build
  node scripts/serve-renderer.mjs 5178
  ```

- Pilotage automatisé de la vraie fenêtre : lancer
  `node_modules/electron/dist/electron.exe . --remote-debugging-port=9333` puis utiliser le protocole
  Chrome DevTools (`http://127.0.0.1:9333/json/list`).

## Conventions

- Code, commentaires, commits et identifiants en anglais ; interface et documentation en français.
- Respecter la règle des couches (voir [architecture.md](architecture.md)) : le domaine n'importe rien,
  l'application n'importe que le domaine.
- Le document est immuable : toute modification passe par le store (jamais de mutation directe).
- Ajout d'un type d'élément : `domain/model.ts` (type), `domain/catalog.ts` (valeurs par défaut),
  `domain/html.ts` (rendu), `presentation/tools.ts` (outil), `presentation/icons.ts` (icône),
  `presentation/panels/propertiesPanel.ts` (contenu), description dans `htmlExporter.ts`, tests, docs.
- Format de projet : changer la structure impose d'incrémenter `DOCUMENT_FORMAT_VERSION` et de gérer la
  migration dans `projectSerializer.ts`.
- Mettre à jour `CHANGELOG.md` et la documentation concernée à chaque changement visible.
