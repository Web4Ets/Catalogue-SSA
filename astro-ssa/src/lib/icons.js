// Icônes SVG line (24x24, currentColor) — remplacent les émojis pour un rendu
// cohérent multi-plateforme. Module léger (aucune donnée) : importable côté
// Astro ET côté client.
export const ICONS = {
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h7"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9 4.5v15"/>',
  compare: '<path d="M7 8h13l-3.5-3.5M7 8l3.5 3.5M17 16H4l3.5 3.5M17 16l-3.5-3.5"/>',
  check: '<path d="M5 12.5l4 4 10-10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.6" cy="6" r=".6" fill="currentColor" stroke="none"/><circle cx="3.6" cy="12" r=".6" fill="currentColor" stroke="none"/><circle cx="3.6" cy="18" r=".6" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3v12M8 11l4 4 4-4M4 20h16"/>',
  quote: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};

// Retourne une chaîne <svg> prête à insérer. `cls` = classes CSS optionnelles.
export function icon(name, cls = '') {
  const body = ICONS[name] || '';
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
