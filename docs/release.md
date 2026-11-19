# Installeurs et releases

## Fichiers produits

| Fichier | Plateforme | Usage |
| --- | --- | --- |
| `UI-Designer-x.y.z-Setup.exe` | Windows x64 | Installeur (choix du dossier, raccourci bureau, association `.uidesign`, désinstallation) |
| `UI-Designer-x.y.z-Portable.exe` | Windows x64 | Exécutable unique sans installation |
| `UI-Designer-x.y.z-x86_64.AppImage` | Linux x64 | Exécutable unique : `chmod +x` puis lancer |

Les exécutables ne sont pas signés : au premier lancement, Windows SmartScreen affiche
« Windows a protégé votre ordinateur » → **Informations complémentaires → Exécuter quand même**.

## Générer en local

```bash
npm run dist
```

Produit les deux fichiers Windows dans `release/` (dossier ignoré par git).

`npm run dist:linux` ne fonctionne que **sous Linux** : depuis Windows, la création de l'AppImage
échoue (liens symboliques interdits sans le mode développeur). L'AppImage est donc construite par
GitHub Actions.

## Publier une release sur GitHub

### Automatique (recommandé)

Le workflow `.github/workflows/release.yml` construit Windows et Linux sur les serveurs de GitHub et
crée la release avec les fichiers attachés et des notes générées depuis les commits.

1. Mettre à jour `CHANGELOG.md` et la version :

   ```bash
   npm version 0.2.0 --no-git-tag-version
   ```

2. Commiter et pousser.
3. Créer et pousser le tag de version :

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. Suivre la construction dans l'onglet **Actions** du dépôt (une dizaine de minutes). La release
   apparaît ensuite dans **Releases**, avec les trois fichiers.

Le workflow peut aussi être lancé à la main (**Actions → Release → Run workflow**) : il construit
alors les fichiers sans publier de release, ils sont téléchargeables dans le résumé de l'exécution
(rubrique *Artifacts*).

### Manuelle, depuis le site GitHub

1. `npm run dist` en local.
2. Sur la page du dépôt : **Releases → Draft a new release**.
3. **Choose a tag** : taper `v0.2.0` puis **Create new tag on publish**.
4. Titre `UI Designer 0.2.0`, coller la section du `CHANGELOG.md` en description (ou
   **Generate release notes**).
5. Glisser `UI-Designer-0.2.0-Setup.exe` et `UI-Designer-0.2.0-Portable.exe` depuis `release/` dans
   la zone des fichiers, puis **Publish release**.

## Icône

`build/icon.svg` est la source ; `build/icon.png` (512 × 512) est utilisé par electron-builder pour
toutes les plateformes. Après modification du SVG :

```bash
npx electron scripts/make-icon.cjs
```
