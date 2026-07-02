// Catalogue : filtrage/recherche/tri/vue sur DOM PRÉ-RENDU (show/hide), chips
// actifs supprimables, compteur sticky, famnav, ZIP fiches par famille.
import './common.js';
import './compare.js';
import './devis.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const t = (k) => window.SSA.t(k);

const els = {
  search: $('#search-input'),
  family: $('#family-filter'),
  sort: $('#sort-select'),
  panel: $('#filter-panel'),
  toggleBtn: $('#filter-toggle-btn'),
  active: $('#active-filters'),
  pmin: $('#filter-pmin'),
  pmax: $('#filter-pmax'),
};
const OPTS = { pmin: Number(els.pmin.min), pmax: Number(els.pmax.max) };
const cards = $$('.product-card');
cards.forEach((c, i) => (c.dataset.order = i)); // ordre source pour le tri "défaut"
const sections = $$('.family-section');
const appLabels = () => (window.__I18N__[window.SSA.lang] || {}).app_labels || {};

// ── URL <-> contrôles ──
function readUrl() {
  const p = new URLSearchParams(location.search);
  const csv = (k) => (p.get(k) || '').split(',').filter(Boolean);
  if (p.get('family')) els.family.value = p.get('family');
  if (p.get('q')) els.search.value = p.get('q');
  ['ip', 'ik', 'feat', 'app'].forEach((key) => csv(key).forEach((v) => {
    const b = $$(`.filter-chip-btn[data-filter-key="${key}"]`).find((x) => x.dataset.filterValue === v);
    if (b) b.classList.add('is-active');
  }));
  if (p.get('pmin')) els.pmin.value = p.get('pmin');
  if (p.get('pmax')) els.pmax.value = p.get('pmax');
  if (csv('ip').length + csv('ik').length + csv('feat').length + csv('app').length || p.get('pmin') || p.get('pmax')) {
    els.panel.hidden = false; els.toggleBtn.setAttribute('aria-expanded', 'true');
  }
}
function writeUrl(s) {
  const p = new URLSearchParams();
  if (s.family !== 'all') p.set('family', s.family);
  if (s.q) p.set('q', els.search.value.trim());
  ['ip', 'ik', 'feat', 'app'].forEach((k) => { if (s[k].length) p.set(k, s[k].join(',')); });
  if (s.pmin > OPTS.pmin) p.set('pmin', s.pmin);
  if (s.pmax < OPTS.pmax) p.set('pmax', s.pmax);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

const activeChips = (key) => $$(`.filter-chip-btn[data-filter-key="${key}"].is-active`).map((b) => b.dataset.filterValue);
function state() {
  return {
    family: els.family.value,
    q: els.search.value.trim().toLowerCase(),
    ip: activeChips('ip'), ik: activeChips('ik'), feat: activeChips('feat'), app: activeChips('app'),
    pmin: els.pmin.value === '' ? OPTS.pmin : Number(els.pmin.value),
    pmax: els.pmax.value === '' ? OPTS.pmax : Number(els.pmax.value),
  };
}

function cardMatches(card, s) {
  if (s.family !== 'all' && card.dataset.family !== s.family) return false;
  if (s.q) {
    const hay = card.dataset.haystack, nq = s.q.replace(/\s+/g, '');
    if (!hay.includes(s.q) && !hay.replace(/\s+/g, '').includes(nq)) return false;
  }
  const has = (attr, sep) => (card.dataset[attr] || '').split(sep).filter(Boolean);
  const ips = has('ip', ' '), iks = has('ik', ' '), feats = has('feats', '|'), apps = has('apps', ' ');
  if (s.ip.length && !s.ip.some((v) => ips.includes(v))) return false;
  if (s.ik.length && !s.ik.some((v) => iks.includes(v))) return false;
  if (s.feat.length && !s.feat.some((v) => feats.includes(v))) return false;
  if (s.app.length && !s.app.some((v) => apps.includes(v))) return false;
  const hasMin = s.pmin > OPTS.pmin, hasMax = s.pmax < OPTS.pmax;
  if (hasMin || hasMax) {
    const watts = (card.dataset.watts || '').split(' ').map(Number).filter((w) => !isNaN(w));
    if (!watts.some((w) => (!hasMin || w >= s.pmin) && (!hasMax || w <= s.pmax))) return false;
  }
  return true;
}

const wattsOf = (c) => (c.dataset.watts || '').split(' ').map(Number).filter((w) => !isNaN(w));
function comparator(mode) {
  if (mode === 'name') return (a, b) => a.querySelector('.product-name').textContent.localeCompare(b.querySelector('.product-name').textContent, undefined, { sensitivity: 'base' });
  if (mode === 'power_asc') return (a, b) => (Math.min(...wattsOf(a).concat(Infinity))) - (Math.min(...wattsOf(b).concat(Infinity)));
  if (mode === 'power_desc') return (a, b) => (Math.max(...wattsOf(b).concat(-Infinity))) - (Math.max(...wattsOf(a).concat(-Infinity)));
  return (a, b) => Number(a.dataset.order) - Number(b.dataset.order);
}

function apply() {
  const s = state();
  writeUrl(s);
  let count = 0;
  const cmp = comparator(els.sort.value);
  for (const sec of sections) {
    const grid = sec.querySelector('[data-grid]');
    const secCards = $$('.product-card', grid);
    let visible = 0;
    secCards.forEach((c) => { const ok = cardMatches(c, s); c.style.display = ok ? '' : 'none'; if (ok) visible++; });
    // tri des cartes visibles
    secCards.filter((c) => c.style.display !== 'none').sort(cmp).forEach((c) => grid.appendChild(c));
    sec.style.display = visible ? '' : 'none';
    count += visible;
  }
  // famnav : masque les familles vides
  $$('.famnav__chip').forEach((chip) => {
    const sec = document.getElementById('family-' + chip.dataset.family);
    chip.style.display = sec && sec.style.display !== 'none' ? '' : 'none';
  });
  const famVisible = sections.filter((sec) => sec.style.display !== 'none').length;
  $('#famnav').style.display = famVisible > 1 ? '' : 'none';
  renderActive(s, count, famVisible);
  if (count === 0 && !$('#empty-state')) {
    const e = document.createElement('div'); e.id = 'empty-state'; e.className = 'empty-state'; e.textContent = t('no_results');
    $('#catalogue-container').appendChild(e);
  } else if (count > 0) { $('#empty-state')?.remove(); }
}

function renderActive(s, count, famVisible) {
  const el = els.active;
  const labels = appLabels();
  const chips = [];
  if (s.family !== 'all') { const o = els.family.selectedOptions[0]; chips.push({ label: `${t('family')} : ${o.textContent}`, type: 'family' }); }
  s.ip.forEach((v) => chips.push({ label: `IP : ${v}`, type: 'chip', key: 'ip', value: v }));
  s.ik.forEach((v) => chips.push({ label: `IK : ${v}`, type: 'chip', key: 'ik', value: v }));
  s.feat.forEach((v) => chips.push({ label: v, type: 'chip', key: 'feat', value: v }));
  s.app.forEach((v) => chips.push({ label: labels[v] || v, type: 'chip', key: 'app', value: v }));
  if (s.pmin > OPTS.pmin || s.pmax < OPTS.pmax) chips.push({ label: `${t('power_label')} : ${s.pmin}–${s.pmax} W`, type: 'power' });

  const countHtml = `<span class="results-count"><strong>${count}</strong> ${t('products_count')} · ${famVisible} ${t('families_label')}</span>`;
  const chipsHtml = chips.map((c) => `<span class="filter-chip filter-chip--removable" data-chip-type="${c.type}"${c.key ? ` data-chip-key="${c.key}"` : ''}${c.value != null ? ` data-chip-value="${c.value}"` : ''}><span>${c.label}</span><button type="button" class="filter-chip__x" aria-label="${t('remove')}">×</button></span>`).join('');
  el.innerHTML = countHtml + (chips.length ? `<span class="filtered-by-label">${t('filtered_by')} :</span>${chipsHtml}<button type="button" class="filter-clear" id="active-clear">${t('clear_filter')}</button>` : '');
}

function resetAll() {
  els.family.value = 'all'; els.search.value = '';
  $$('.filter-chip-btn.is-active').forEach((b) => b.classList.remove('is-active'));
  els.pmin.value = OPTS.pmin; els.pmax.value = OPTS.pmax;
  apply();
}

// ── Vue grille/liste ──
function setView(v) {
  localStorage.setItem('catalogue-view', v);
  $$('[data-grid]').forEach((g) => g.classList.toggle('product-grid--list', v === 'list'));
  $$('.view-toggle__btn').forEach((b) => { const on = b.dataset.view === v; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
}

// ── ZIP fiches par famille (JSZip à la demande) ──
let _jszip = null;
function ensureJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (_jszip) return _jszip;
  _jszip = new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/assets/vendor/jszip.min.js'; s.onload = () => res(window.JSZip); s.onerror = () => { _jszip = null; rej(); }; document.head.appendChild(s); });
  return _jszip;
}
async function familyZip(familyId, btn) {
  const DATA = await window.SSA.loadData();
  const fam = DATA.families.find((f) => f.id === familyId);
  const lang = window.SSA.lang;
  const files = DATA.products.filter((p) => p.family_id === familyId).map((p) => (lang === 'fr' ? p.datasheet_fr : p.datasheet_en)).filter(Boolean);
  if (!files.length) return;
  const original = btn.innerHTML;
  btn.disabled = true;
  const setLabel = (x) => { btn.textContent = x; };
  setLabel(t('zip_preparing'));
  try {
    const JSZip = await ensureJSZip();
    const zip = new JSZip(); let done = 0;
    await Promise.all(files.map(async (name) => { const r = await fetch('/assets/datasheets/' + name); if (r.ok) { zip.file(name, await r.blob()); setLabel(`${++done}/${files.length}`); } }));
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
    const famName = (lang === 'fr' ? fam.name_fr : fam.name_en) || familyId;
    const a = document.createElement('a'); a.href = URL.createObjectURL(content); a.download = `SSA-${famName.replace(/[^\w\-]+/g, '_')}-${lang.toUpperCase()}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) { alert(t('zip_error')); }
  finally { btn.disabled = false; btn.innerHTML = original; }
}

// ── Wiring ──
els.search.addEventListener('input', apply);
els.family.addEventListener('change', apply);
els.sort.addEventListener('change', apply);
els.pmin.addEventListener('change', apply);
els.pmax.addEventListener('change', apply);
els.toggleBtn.addEventListener('click', () => { const open = els.panel.hidden; els.panel.hidden = !open; els.toggleBtn.setAttribute('aria-expanded', String(open)); });
$$('.filter-chip-btn').forEach((b) => b.addEventListener('click', () => { b.classList.toggle('is-active'); apply(); }));
$('#filter-reset').addEventListener('click', resetAll);
$$('.view-toggle__btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
els.active.addEventListener('click', (e) => {
  if (e.target.closest('#active-clear')) { resetAll(); return; }
  if (!e.target.closest('.filter-chip__x')) return;
  const chip = e.target.closest('.filter-chip--removable'), type = chip.dataset.chipType;
  if (type === 'family') els.family.value = 'all';
  else if (type === 'power') { els.pmin.value = OPTS.pmin; els.pmax.value = OPTS.pmax; }
  else $$(`.filter-chip-btn[data-filter-key="${chip.dataset.chipKey}"]`).forEach((b) => { if (b.dataset.filterValue === chip.dataset.chipValue) b.classList.remove('is-active'); });
  apply();
});
document.addEventListener('click', (e) => { const z = e.target.closest('.famzip-btn'); if (z) { e.preventDefault(); familyZip(z.dataset.familyZip, z); } });
window.SSA.onLangChange(apply);

readUrl();
setView(localStorage.getItem('catalogue-view') || 'grid');
apply();
