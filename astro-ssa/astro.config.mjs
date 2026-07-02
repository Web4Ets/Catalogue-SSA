// @ts-check
import { defineConfig } from 'astro/config';

// Catalogue SSA — sortie 100% statique, déployée par FTP sur IONOS.
// `site` sert aux URLs absolues (og:image, sitemap). À adapter au domaine final.
export default defineConfig({
  site: 'https://www.ssa.green',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory', // /produit/<slug>/index.html
  },
  devToolbar: { enabled: false },
});
