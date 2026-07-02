// Fiche produit : galerie (swap miniatures, sans ouvrir la lightbox), lightbox
// sur l'image principale seule, bouton comparateur, export CSV.
import './common.js';
import './compare.js';

// ── Galerie : clic miniature = remplace l'image principale (pas de lightbox) ──
function initFigureThumbs() {
  const fig = document.querySelector('.product-figure--stack');
  if (!fig) return;
  const main = fig.querySelector('.product-figure__img');
  const thumbs = Array.from(fig.querySelectorAll('.pf-thumb'));
  thumbs.forEach((btn) => btn.addEventListener('click', () => {
    const full = btn.dataset.full;
    if (full && main) main.src = full;
    thumbs.forEach((b) => b.classList.toggle('is-active', b === btn));
  }));
}

// ── Lightbox : uniquement l'image principale ──
function initLightbox() {
  document.querySelectorAll('.product-figure__img').forEach((img) => {
    img.classList.add('is-zoomable');
    img.addEventListener('click', () => window.SSA.openLightbox(img.src, img.alt));
  });
}

// ── Bouton comparateur de la fiche ──
function initCompareButton() {
  const btn = document.getElementById('compare-product-btn');
  if (!btn) return;
  const id = btn.dataset.compareId;
  const refresh = () => {
    const on = (window.SSA_compare?.isComparing?.(id)) || false;
    btn.classList.toggle('is-active-compare', on);
    btn.innerHTML = window.SSA.icon(on ? 'check' : 'compare') + ' ' + (on ? window.SSA.t('compare_added') : window.SSA.t('compare'));
  };
  refresh();
  btn.addEventListener('click', () => { window.SSA_compare.toggleCompare(id); refresh(); });
  window.SSA.onLangChange(refresh);
}

// ── Export CSV des références ──
function escapeCsv(value) {
  const s = String(value ?? '').replace(/[\r\n]+/g, ' ');
  if (/[;"\n\r]/.test(s) || /^[=+\-@]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function tableColumns(p, DATA) {
  if (Array.isArray(p.table_columns) && p.table_columns.length) return p.table_columns;
  const fam = DATA.families.find((f) => f.id === p.family_id);
  return (DATA.table_schemas && DATA.table_schemas[(fam && fam.table_schema) || 'ssa'])
    || ['code_slx', 'designation', 'power', 'lumen', 'efficacy', 'cct'];
}
async function exportCsv() {
  const DATA = await window.SSA.loadData();
  const id = (location.pathname.match(/produit\/([^/]+)/) || [])[1];
  const p = DATA.products.find((x) => x.id === id);
  if (!p) return;
  const lang = window.SSA.lang;
  const schema = tableColumns(p, DATA);
  const headers = (DATA.i18n[lang].table_headers) || {};
  const rows = [schema.map((c) => headers[c] || c)];
  for (const v of p.variants) {
    rows.push(schema.map((c) => {
      let val = v[c];
      if ((c === 'weight' || c === 'dimensions') && typeof val === 'string') val = val.replace(/;\s*/g, ' / ');
      return val;
    }));
  }
  const BOM = String.fromCharCode(0xFEFF);
  const csv = BOM + rows.map((r) => r.map(escapeCsv).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${id}-variants.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ── Flèches clavier ←/→ : produit précédent/suivant ──
function initKeyNav() {
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    const lb = document.getElementById('lightbox');
    if (lb && lb.classList.contains('is-open')) return;
    const prev = document.querySelector('.product-nav__btn[data-nav="prev"]');
    const next = document.querySelector('.product-nav__btn[data-nav="next"]');
    if (e.key === 'ArrowLeft' && prev) location.href = prev.href;
    else if (e.key === 'ArrowRight' && next) location.href = next.href;
  });
}

initFigureThumbs();
initLightbox();
initCompareButton();
initKeyNav();
document.getElementById('csv-export-btn')?.addEventListener('click', exportCsv);
