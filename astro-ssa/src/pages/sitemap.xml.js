// Sitemap XML généré au build (sans dépendance externe) — liste les pages
// statiques + une URL par fiche produit. Domaine canonique : https://ssa.green.
import { products } from '../lib/catalogue.js';

const BASE = 'https://ssa.green';

// Pages statiques (trailingSlash: 'always'). Priorité indicative pour les moteurs.
const staticPages = [
  { path: '', priority: '1.0' },
  { path: 'catalogue/', priority: '0.9' },
  { path: 'a-propos/', priority: '0.6' },
  { path: 'contact/', priority: '0.6' },
  { path: 'comparer/', priority: '0.5' },
  { path: 'devis/', priority: '0.5' },
];

export async function GET() {
  const urls = [
    ...staticPages.map((p) => ({ loc: `${BASE}/${p.path}`, priority: p.priority })),
    ...products.map((p) => ({ loc: `${BASE}/produit/${p.id}/`, priority: '0.8' })),
  ];

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`,
      )
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
