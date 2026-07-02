// Page comparateur : lit ?ids=, construit le tableau comparatif (porté de l'ancien
// renderCompare). Données via SSA.loadData().
import './common.js';
import './compare.js';

const t = (k) => window.SSA.t(k);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const parseNum = (s) => { if (s == null) return null; const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const parseWatts = (v) => { const m = String(v ?? '').match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : null; };
function fieldRange(p, field, parser) {
  const vals = (p.variants || []).map((v) => parser(v[field])).filter((x) => x !== null && !isNaN(x));
  if (!vals.length) return null;
  return { mn: Math.min(...vals), mx: Math.max(...vals) };
}
const fmtRange = (r, u) => (!r ? '—' : (r.mn === r.mx ? `${r.mn}${u || ''}` : `${r.mn}–${r.mx}${u || ''}`));

async function render() {
  const container = document.getElementById('compare-container');
  if (!container) return;
  const DATA = await window.SSA.loadData();
  const lang = window.SSA.lang;
  const familyName = (f) => (f ? (lang === 'en' ? f.name_en : f.name_fr) : '—');
  const ids = (new URLSearchParams(location.search).get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length) localStorage.setItem('compare', JSON.stringify(ids.slice(0, 4)));
  const products = ids.map((id) => DATA.products.find((p) => p.id === id)).filter(Boolean);

  const heading = `<h1 class="section-title">${t('compare_title')}</h1>`;
  if (!products.length) {
    container.innerHTML = `${heading}<div class="empty-state"><p>${t('compare_empty')}</p>
      <p style="margin-top:16px;"><a class="btn btn-primary" href="/catalogue/">${t('catalogue')}</a></p></div>`;
    return;
  }
  const familyOf = (p) => DATA.families.find((f) => f.id === p.family_id);
  const ipOf = (p) => (p.features_fr || []).find((f) => /^IP\d+K?$/i.test(f)) || '—';
  const feats = (p) => (lang === 'fr' ? p.features_fr : p.features_en) || [];
  const th = (col) => (DATA.i18n[lang].table_headers || {})[col] || col;

  const rows = [
    [t('family'), (p) => esc(familyName(familyOf(p)))],
    [t('power_label'), (p) => esc(fmtRange(fieldRange(p, 'power', parseWatts), ' W'))],
    [th('lumen'), (p) => esc(fmtRange(fieldRange(p, 'lumen', parseNum), ' lm'))],
    [th('efficacy'), (p) => esc(fmtRange(fieldRange(p, 'efficacy', parseNum), ' lm/W'))],
    ['IP', (p) => esc(ipOf(p))],
    [t('compare_variants'), (p) => String((p.variants || []).length)],
    [t('features'), (p) => feats(p).slice(0, 8).map((f) => `<span class="feature-chip">${esc(f)}</span>`).join(' ')],
    [t('download_datasheet'), (p) => { const ds = lang === 'fr' ? p.datasheet_fr : p.datasheet_en; return ds ? `<a class="btn-download alt" href="/assets/datasheets/${ds}" download>📄 PDF</a>` : '—'; }],
  ];

  const head = `<th class="compare-attr-head">${t('compare_attribute')}</th>` + products.map((p) => `
    <th class="compare-prod-head">
      <span class="compare-remove" role="button" tabindex="0" data-compare-id="${esc(p.id)}" aria-label="${t('remove')}">×</span>
      <a href="/produit/${encodeURIComponent(p.id)}/" class="compare-prod-link">
        <span class="compare-prod-img"><img src="/assets/images/${p.image}" alt="${esc(p.name_slx)}" loading="lazy" /></span>
        <span class="compare-prod-name">${esc(p.name_slx)}</span>
      </a>
    </th>`).join('');
  const body = rows.map(([label, fn]) => `<tr><th class="compare-attr">${esc(label)}</th>${products.map((p) => `<td>${fn(p)}</td>`).join('')}</tr>`).join('');

  container.innerHTML = `
    <div class="compare-head-row">${heading}
      <button type="button" class="btn btn-outline btn-sm" id="compare-clear-btn">${t('compare_clear')}</button>
    </div>
    <div class="compare-table-wrap"><table class="compare-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// retrait d'un produit du comparatif → re-render
document.addEventListener('click', (e) => {
  const rem = e.target.closest('.compare-remove');
  if (rem) { e.preventDefault(); window.SSA_compare?.toggleCompare(rem.dataset.compareId); render(); }
  if (e.target.closest('#compare-clear-btn')) { e.preventDefault(); window.SSA_compare?.clearCompare(); render(); }
});
window.SSA.onLangChange(render);
render();
