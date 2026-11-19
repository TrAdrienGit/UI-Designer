# UI Designer — notes pour Claude

Logiciel de bureau (Electron + TypeScript, hors ligne) pour dessiner des interfaces web / HUD et exporter
un fichier HTML unique lisible par les IA. Projet personnel de Gwen, publié sur GitHub
(`TrAdrienGit/UI-Designer`).

## Règles du projet

- Commit **et push** de chaque étape terminée et testée, sans demander ; créer des branches si utile.
- À chaque **nouvelle version** (changement de `version` dans `package.json`) : régénérer l'installeur
  Windows avec `npm run dist` (fichiers dans `release/`, non versionnés), vérifier que l'exe démarre,
  et le signaler à Gwen. Linux est un bonus construit par GitHub Actions au tag `vX.Y.Z` ; ne jamais
  modifier le code juste pour Linux. Procédure : `docs/release.md`.
- Licence : domaine public (Unlicense).
- Discussion en français ; code, commentaires et messages de commit en anglais ; interface et docs en
  français.
- Je gère la documentation (`README.md`, `docs/`, `CHANGELOG.md`), les tests (`tests/`, Vitest) et les
  logs (voir `docs/development.md`).
- Architecture en couches stricte : `domain` → rien ; `application` → domain ; `infrastructure` →
  domain + application ; `presentation` → tout ; `main` / `preload` = racines Electron. Détails :
  `docs/architecture.md`.
- Le document est immuable ; toute modification passe par `EditorStore`.

## Vérifier un changement

```bash
npm run check
npm run build
```

Puis lancer l'appli (`npm start`) ou, pour un test visuel automatisé, la démarrer avec
`--remote-debugging-port=9333` et la piloter par CDP. Ne pas laisser de fenêtre Electron ouverte après
un test.
