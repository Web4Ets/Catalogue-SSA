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
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9 8.6-8.6A2 2 0 0 1 11 3.8H19a2 2 0 0 1 2 2v6a2 2 0 0 1-.4 1.6Z"/><circle cx="16.3" cy="7.7" r="1.3"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};

// Retourne une chaîne <svg> prête à insérer. `cls` = classes CSS optionnelles.
export function icon(name, cls = '') {
  const body = ICONS[name] || '';
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
