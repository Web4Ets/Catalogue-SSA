// Helpers partagés — utilisables au build (frontmatter Astro) ET côté client.
// Source de données : src/data/products.json (généré par build_data.py).
import data from '../data/products.json';

export const DATA = data;
export const products = data.products;
export const families = data.families;
export const i18n = data.i18n;
export const site = data.site;

export const familyById = (id) => families.find((f) => f.id === id);
export const familyName = (fam, lang = 'fr') => (fam ? (lang === 'fr' ? fam.name_fr : fam.name_en) : '');
export const productById = (id) => products.find((p) => p.id === id);

export function parseWatts(v) {
  const m = String(v ?? '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}
export function productWatts(p) {
  return (p.variants || []).map((v) => parseWatts(v.power)).filter((w) => w !== null);
}
export function productWattRange(p) {
  const w = productWatts(p);
  if (!w.length) return null;
  const mn = Math.min(...w), mx = Math.max(...w);
  return mn === mx ? `${mn} W` : `${mn}–${mx} W`;
}
export const productMinWatt = (p) => { const w = productWatts(p); return w.length ? Math.min(...w) : null; };
export const productMaxWatt = (p) => { const w = productWatts(p); return w.length ? Math.max(...w) : null; };

export const ipRating = (p) => (p.features_fr || []).find((f) => /^IP\d+K?$/i.test(f)) || null;

// Texte de recherche (indexé en data-attribute sur la carte, pour le filtrage client).
export function haystack(p, lang = 'fr') {
  const appLabels = (i18n[lang] || {}).app_labels || {};
  const fam = familyById(p.family_id);
  const parts = [p.name_slx, familyName(fam, lang)];
  (p.features_fr || []).forEach((f) => parts.push(f));
  (p.applications || []).forEach((k) => parts.push(appLabels[k] || k));
  (p.tech_specs || []).forEach((s) => parts.push(lang === 'fr' ? s.fr : s.en));
  for (const v of p.variants) parts.push(v.code_slx, v.designation, v.power, v.lumen, v.efficacy, v.cct, v.panel, v.battery);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// Colonnes du tableau des références pour un produit (pruning déjà fait au build).
export function tableColumns(p) {
  if (Array.isArray(p.table_columns) && p.table_columns.length) return p.table_columns;
  const fam = familyById(p.family_id);
  const schema = (fam && fam.table_schema) || 'ssa';
  return (DATA.table_schemas && DATA.table_schemas[schema])
    || ['code_slx', 'designation', 'power', 'lumen', 'efficacy', 'cct'];
}

// Pictogrammes d'applications (line icons, currentColor).
export const APP_ICONS = {
  roads: '<path d="M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v2"/>',
  residential: '<path d="M3 11 12 4l9 7M5 10v10h14V10"/>',
  pedestrian: '<circle cx="6.5" cy="16.5" r="3"/><circle cx="17.5" cy="16.5" r="3"/><path d="M6.5 16.5 11 7.5h4M11 7.5l3.5 9M9.5 16.5h4.5"/>',
  squares: '<circle cx="12" cy="9" r="5"/><path d="M12 14v7"/>',
  parking: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M9.5 17V7h3.2a2.6 2.6 0 0 1 0 5.2H9.5"/>',
  bridges: '<path d="M3 18h18M5.5 18v-6M18.5 18v-6M5.5 12c4.3 4 8.7 4 13 0M5.5 12C5.5 8 8.4 6 12 6s6.5 2 6.5 6"/>',
  railway: '<rect x="6" y="3" width="12" height="13" rx="2.5"/><path d="M6 11h12M9 16l-2 4M15 16l2 4"/>',
  large_areas: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M7 12h10M7 12l2-2M7 12l2 2M17 12l-2-2M17 12l-2 2"/>',
  industrial: '<path d="M3 21V11l5 3V11l5 3V8h8v13Z"/><path d="M16 12h2M16 16h2"/>',
  sport: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="3.5" ry="2.2"/>',
  tunnels: '<path d="M3 21V13a9 9 0 0 1 18 0v8M8.5 21v-8a3.5 3.5 0 0 1 7 0v8"/>',
  accent: '<rect x="4" y="9" width="9" height="12" rx="1"/><path d="M6.5 13h4M6.5 17h4M16 8l4-2M16 12h4M16 16l4 2"/>',
};

export const t = (lang, key) => {
  const dict = i18n[lang] || i18n.fr || {};
  return key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), dict) ?? key;
};
