# Déploiement du catalogue SSA (Astro) sur IONOS (FTP)

Le site Astro se construit en **statique** (`dist/`) puis se dépose par **FTP** sur
l'hébergement web IONOS. IONOS ne fait aucun build : on envoie `dist/` déjà construit.

## 1. Construire le site
```bash
cd astro-ssa
npm install          # (une seule fois)
npm run build        # sync des assets + build → astro-ssa/dist/
```
`npm run build` régénère au passage `dist/` à partir de `data/products.json` et des
assets de la racine (via `npm run sync`). ⚠️ Pensez à lancer d'abord, à la racine,
`python -X utf8 build_data.py` et `generate_datasheets.py` si les données/PDF ont changé.

## 2a. Déposer par FTP — méthode automatique (recommandée)
1. Dans IONOS → **Hébergement → Accès FTP/SFTP**, récupérez : serveur, utilisateur, mot de passe.
2. Copiez `.env.example` en `.env` et renseignez ces valeurs :
   ```
   FTP_HOST=accessXXXXXXXX.webspace-host.com
   FTP_USER=uXXXXXXXX
   FTP_PASSWORD=••••••••
   FTP_REMOTE_DIR=/          # ou /htdocs selon votre offre
   FTP_SECURE=false          # true si FTPS explicite supporté
   ```
   `.env` est **git-ignoré** : vos identifiants ne sont jamais commités.
3. Lancez :
   ```bash
   npm run deploy
   ```
   → upload récursif de `dist/` vers le dossier web IONOS.

## 2b. Déposer par FTP — méthode manuelle (FileZilla)
1. Ouvrez **FileZilla**, connectez-vous avec les identifiants IONOS (port 21 FTP / 22 SFTP).
2. Côté distant, ouvrez le **dossier racine web** (souvent `/`, parfois `/htdocs`).
3. Glissez **tout le contenu de `astro-ssa/dist/`** (et non le dossier `dist` lui-même)
   dans ce dossier. Écrasez si demandé.

## 3. Vérifier
- Ouvrez votre domaine : l'accueil, `/catalogue/`, une fiche `/produit/<code>/`, `/comparer/`.
- Les fiches PDF se téléchargent, la recherche/les filtres/le comparateur fonctionnent.

## Notes
- **Domaine** : ajustez `site` dans `astro.config.mjs` (utilisé pour les URLs absolues
  SEO/og:image). Si le site n'est pas à la racine du domaine, ajoutez aussi `base`.
- **Mise à jour** : reconstruire (`npm run build`) puis redéposer (`npm run deploy`).
- Les identifiants FTP sont **les vôtres** — gardez `.env` hors du dépôt (déjà ignoré).
