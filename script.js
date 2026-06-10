// ===== State =====
const STATE = {
  lang: localStorage.getItem('lang') || 'fr',
  data: null,
  catalogueView: localStorage.getItem('catalogue-view') || 'grid', // 'grid' | 'list'
  catalogueSort: localStorage.getItem('catalogue-sort') || 'default', // 'default'|'name'|'power_asc'|'power_desc'
};

// ===== Data =====
async function loadData() {
  if (STATE.data) return STATE.data;
  // 'no-cache' = always revalidate (ETag/Last-Modified) so catalogue data is
  // never stale after a rebuild/deploy, while staying cheap (304 when unchanged).
  const res = await fetch('data/products.json', { cache: 'no-cache' });
  STATE.data = await res.json();
  return STATE.data;
}

function t(key) {
  const dict = STATE.data.i18n[STATE.lang];
  return key.split('.').reduce((o, k) => o && o[k], dict) || key;
}

// ===== Language switch =====
function setLang(lang) {
  STATE.lang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  if (typeof renderPage === 'function') renderPage();
}

function initLangSwitch() {
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.addEventListener('click', () => setLang(b.dataset.lang));
    b.classList.toggle('active', b.dataset.lang === STATE.lang);
  });
  document.documentElement.lang = STATE.lang;
}

// ===== Helpers =====
function applyStaticI18n() {
  document.title = t('site_title');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

function familyName(family) {
  return STATE.lang === 'fr' ? family.name_fr : family.name_en;
}
function familyTagline(family) {
  return STATE.lang === 'fr' ? family.tagline_fr : family.tagline_en;
}
function supplierTagline(supplier) {
  return STATE.lang === 'fr' ? supplier.tagline_fr : supplier.tagline_en;
}

function countByFamily(familyId) {
  return STATE.data.products.filter(p => p.family_id === familyId).length;
}
function countBySupplier(supplierId) {
  return STATE.data.products.filter(p => p.supplier_id === supplierId).length;
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ===== Image fallback (broken images get a styled placeholder) =====
// Templates set `data-fallback-code` and `data-fallback-label` on <img>; the
// global capture-phase error listener swaps the broken image for a placeholder.
function applyImageFallback(img) {
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = '1';
  const code = img.dataset.fallbackCode || '?';
  const label = img.dataset.fallbackLabel || '';
  const ph = document.createElement('div');
  ph.className = 'image-placeholder';
  ph.innerHTML = `
    <div class="image-placeholder__code">${escapeHtml(code)}</div>
    ${label ? `<div class="image-placeholder__label">${escapeHtml(label)}</div>` : ''}
  `;
  img.replaceWith(ph);
}
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG' && e.target.dataset.fallbackCode) {
    applyImageFallback(e.target);
  }
}, true); // capture phase since the error event doesn't bubble

// ===== Recently viewed (localStorage) =====
const RECENT_KEY = 'ssa-recent-products';
const RECENT_MAX = 8;

function getRecentIds() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}
function pushRecent(productId) {
  if (!productId) return;
  const ids = getRecentIds().filter(id => id !== productId);
  ids.unshift(productId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX)));
}
function getRecentProducts(excludeId = null, limit = 6) {
  const ids = getRecentIds();
  return ids
    .filter(id => id !== excludeId)
    .map(id => STATE.data.products.find(p => p.id === id))
    .filter(Boolean)
    .slice(0, limit);
}

// ===== Back-to-top button (injected once on every page) =====
function initBackToTop() {
  if (document.getElementById('back-to-top')) return;
  const btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '↑';
  document.body.appendChild(btn);
  const update = () => btn.classList.toggle('visible', window.scrollY > 500);
  update();
  window.addEventListener('scroll', update, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===== HOME: new hybrid layout =====
function familyHighlights(family) {
  return STATE.lang === 'fr' ? (family.highlights_fr || []) : (family.highlights_en || []);
}

function renderFeaturedProduct() {
  const el = document.getElementById('featured-product');
  if (!el) return;
  const featuredId = STATE.data.site?.featured_product_id;
  const p = STATE.data.products.find(x => x.id === featuredId);
  if (!p) { el.innerHTML = ''; return; }
  const family = STATE.data.families.find(f => f.id === p.family_id);
  const description = STATE.lang === 'fr' ? p.description_fr : p.description_en;
  const shortDesc = description.length > 280 ? description.slice(0, 280).replace(/\s+\S*$/, '') + '…' : description;
  const features = (STATE.lang === 'fr' ? p.features_fr : p.features_en).slice(0, 6);

  el.innerHTML = `
    <div class="featured-text">
      <span class="featured-kicker">${escapeHtml(t('featured_label'))}</span>
      <h2 class="featured-name">${escapeHtml(p.name_slx)}</h2>
      <div class="featured-family">${escapeHtml(familyName(family))}</div>
      <p class="featured-desc">${escapeHtml(shortDesc)}</p>
      <div class="featured-features">
        ${features.map(f => `<span class="feature-chip">${escapeHtml(f)}</span>`).join('')}
      </div>
      <div class="featured-cta">
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="btn btn-primary">${escapeHtml(t('featured_cta'))} →</a>
        <a href="assets/datasheets/${STATE.lang === 'fr' ? p.datasheet_fr : p.datasheet_en}" class="btn btn-outline" download>📄 ${escapeHtml(t('download_datasheet'))}</a>
      </div>
    </div>
    <div class="featured-image">
      <img src="assets/images/${p.image}" alt="${escapeHtml(p.name_slx)}"
        data-fallback-code="${escapeHtml(p.code_prefix)}"
        data-fallback-label="${escapeHtml(familyName(family))}" />
    </div>
  `;
}

function renderRichFamilies() {
  const el = document.getElementById('families-grid');
  if (!el) return;
  el.innerHTML = STATE.data.families.map(f => {
    const n = countByFamily(f.id);
    const highlights = familyHighlights(f);
    return `
      <a class="family-rich-card" href="catalogue.html?family=${encodeURIComponent(f.id)}">
        <div class="family-rich-card__media">
          <img src="assets/images/${f.image}" alt="${escapeHtml(familyName(f))}" loading="lazy"
            data-fallback-code="${escapeHtml(f.id.toUpperCase())}"
            data-fallback-label="${escapeHtml(familyName(f))}" />
        </div>
        <div class="family-rich-card__body">
          <div class="family-rich-card__meta">
            <span>${n} ${escapeHtml(t('products_count'))}</span>
          </div>
          <h3 class="family-rich-card__title">${escapeHtml(familyName(f))}</h3>
          <p class="family-rich-card__tagline">${escapeHtml(familyTagline(f))}</p>
          <ul class="family-rich-card__highlights">
            ${highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
          </ul>
          <span class="family-rich-card__link">${escapeHtml(t('view_catalogue'))} →</span>
        </div>
      </a>
    `;
  }).join('');
}

function renderSuppliers() {
  const el = document.getElementById('suppliers-grid');
  if (!el) return;
  el.innerHTML = STATE.data.suppliers.map(s => {
    const n = countBySupplier(s.id);
    return `
      <a class="supplier-rich-card" href="catalogue.html?supplier=${encodeURIComponent(s.id)}">
        <div class="supplier-rich-card__mark">${escapeHtml(s.name)}</div>
        <div class="supplier-rich-card__body">
          <h3 class="supplier-rich-card__title">${escapeHtml(s.name)}</h3>
          <p class="supplier-rich-card__tagline">${escapeHtml(supplierTagline(s))}</p>
          <div class="supplier-rich-card__stats">
            <span><strong>${n}</strong> ${escapeHtml(t('products_count'))}</span>
          </div>
        </div>
        <div class="supplier-rich-card__arrow">→</div>
      </a>
    `;
  }).join('');
}

function renderFeaturedGrid() {
  const el = document.getElementById('featured-products-grid');
  if (!el) return;
  const ids = STATE.data.site?.featured_products_ids || [];
  const products = ids.map(id => STATE.data.products.find(p => p.id === id)).filter(Boolean);
  el.innerHTML = products.map(p => productCard(p)).join('');
}

function renderRecentSection() {
  const section = document.getElementById('recent-products-section');
  const grid = document.getElementById('recent-products-grid');
  if (!section || !grid) return;
  const recent = getRecentProducts(null, 6);
  if (recent.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  grid.innerHTML = recent.map(p => productCard(p)).join('');
}

function renderHome() {
  renderFeaturedProduct();
  renderRichFamilies();
  renderFeaturedGrid();
  renderRecentSection();
}

// ===== CATALOGUE page =====
function parseWatts(s) {
  // Extracts the leading numeric W value from strings like "30W", "100W(15/10 select)",
  // "20W (Down light 10W, Up light 10W)". Returns null if no leading wattage.
  const m = String(s || '').match(/(\d+(?:\.\d+)?)\s*W/i);
  return m ? parseFloat(m[1]) : null;
}

function extractFilterOptions(products) {
  // Auto-discover filter values from product data. No hardcoded list.
  const ipCounts = new Map();
  const ikCounts = new Map();
  const featCounts = new Map();
  let pmin = Infinity, pmax = -Infinity;

  // Noise filters — these patterns appear in features but aren't useful as chip filters.
  const isNoise = (f) =>
    /^\d/.test(f) ||                  // starts with digit (e.g. "30-100W", "150 lm/W")
    /lm\/W$/i.test(f) ||             // efficacy values
    /^Beam/i.test(f) ||              // beam angles
    /^Up to/i.test(f) ||             // "Up to 200lm/W"
    /^\d+°/.test(f);                 // beam angles like "120°"

  for (const p of products) {
    const features = new Set(p.features_fr || []);
    for (const f of features) {
      if (/^IP\d+K?$/i.test(f)) ipCounts.set(f, (ipCounts.get(f) || 0) + 1);
      else if (/^IK\d+$/i.test(f)) ikCounts.set(f, (ikCounts.get(f) || 0) + 1);
      else if (!isNoise(f)) featCounts.set(f, (featCounts.get(f) || 0) + 1);
    }
    for (const v of p.variants) {
      const w = parseWatts(v.power);
      if (w !== null) {
        if (w < pmin) pmin = w;
        if (w > pmax) pmax = w;
      }
    }
  }

  const sortByCountDesc = (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const sortIpIk = (a, b) => a.localeCompare(b, undefined, { numeric: true });

  return {
    ips: [...ipCounts.keys()].sort(sortIpIk),
    iks: [...ikCounts.keys()].sort(sortIpIk),
    // Keep features that appear in ≥2 products; cap at 24 to keep UI manageable.
    feats: [...featCounts.entries()]
      .filter(([, c]) => c >= 2)
      .sort(sortByCountDesc)
      .slice(0, 24)
      .map(([v]) => v),
    pmin: pmin === Infinity ? 0 : Math.floor(pmin),
    pmax: pmax === -Infinity ? 1000 : Math.ceil(pmax),
  };
}

function getUrlFilters() {
  const params = new URLSearchParams(location.search);
  const csv = (k) => (params.get(k) || '').split(',').filter(Boolean);
  const num = (k) => params.has(k) ? Number(params.get(k)) : null;
  return {
    supplier: params.get('supplier') || 'all',
    family: params.get('family') || 'all',
    q: params.get('q') || '',
    ip: csv('ip'),
    ik: csv('ik'),
    feat: csv('feat'),
    pmin: num('pmin'),
    pmax: num('pmax'),
  };
}

function setUrlFilters({ family, q, ip, ik, feat, pmin, pmax, defaultPmin, defaultPmax }) {
  const params = new URLSearchParams();
  if (family && family !== 'all') params.set('family', family);
  if (q) params.set('q', q);
  if (ip?.length) params.set('ip', ip.join(','));
  if (ik?.length) params.set('ik', ik.join(','));
  if (feat?.length) params.set('feat', feat.join(','));
  if (pmin != null && defaultPmin != null && pmin > defaultPmin) params.set('pmin', String(pmin));
  if (pmax != null && defaultPmax != null && pmax < defaultPmax) params.set('pmax', String(pmax));
  const qs = params.toString();
  const next = location.pathname + (qs ? '?' + qs : '');
  history.replaceState(null, '', next);
}

function getActiveAdvancedFilters() {
  const collect = (key) => Array.from(
    document.querySelectorAll(`.filter-chip-btn[data-filter-key="${key}"].is-active`)
  ).map(b => b.dataset.filterValue);
  const pminInput = document.getElementById('filter-pmin');
  const pmaxInput = document.getElementById('filter-pmax');
  return {
    ip: collect('ip'),
    ik: collect('ik'),
    feat: collect('feat'),
    pmin: pminInput && pminInput.value !== '' ? Number(pminInput.value) : null,
    pmax: pmaxInput && pmaxInput.value !== '' ? Number(pmaxInput.value) : null,
  };
}

function renderCatalogue() {
  const data = STATE.data;
  const searchInput = document.getElementById('search-input');
  const familyFilter = document.getElementById('family-filter');
  const container = document.getElementById('catalogue-container');
  if (!container) return;

  const query = (searchInput?.value || '').trim().toLowerCase();
  const selectedFamily = familyFilter?.value || 'all';
  const adv = getActiveAdvancedFilters();
  const opts = STATE.filterOpts || extractFilterOptions(data.products);

  setUrlFilters({
    family: selectedFamily, q: query,
    ip: adv.ip, ik: adv.ik, feat: adv.feat,
    pmin: adv.pmin, pmax: adv.pmax,
    defaultPmin: opts.pmin, defaultPmax: opts.pmax,
  });

  const filtered = data.products.filter(p => {
    if (selectedFamily !== 'all' && p.family_id !== selectedFamily) return false;
    if (query) {
      const match = p.name_slx.toLowerCase().includes(query)
        || p.variants.some(v =>
            (v.code_slx || '').toLowerCase().includes(query) ||
            (v.designation || '').toLowerCase().includes(query));
      if (!match) return false;
    }
    const features = new Set(p.features_fr || []);
    // IP / IK / Feat = OR within group (multi-select = "any of these")
    if (adv.ip.length && !adv.ip.some(v => features.has(v))) return false;
    if (adv.ik.length && !adv.ik.some(v => features.has(v))) return false;
    if (adv.feat.length && !adv.feat.some(v => features.has(v))) return false;
    // Power range: at least one variant with wattage in [pmin..pmax]
    const hasPmin = adv.pmin != null && adv.pmin > opts.pmin;
    const hasPmax = adv.pmax != null && adv.pmax < opts.pmax;
    if (hasPmin || hasPmax) {
      const inRange = p.variants.some(v => {
        const w = parseWatts(v.power);
        if (w === null) return false;
        if (hasPmin && w < adv.pmin) return false;
        if (hasPmax && w > adv.pmax) return false;
        return true;
      });
      if (!inRange) return false;
    }
    return true;
  });

  renderActiveFilters({ family: selectedFamily, ...adv, opts });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('no_results')}</div>`;
    return;
  }

  // Group by family
  const groups = {};
  for (const p of filtered) {
    (groups[p.family_id] = groups[p.family_id] || []).push(p);
  }

  const gridClass = STATE.catalogueView === 'list' ? 'product-grid product-grid--list' : 'product-grid';
  const presentFamilies = data.families.filter(f => groups[f.id]);

  // Sort products within each family group (source order kept for 'default')
  const cmp = productSortComparator(STATE.catalogueSort);
  if (cmp) presentFamilies.forEach(f => groups[f.id].sort(cmp));

  // Results summary (count of products + families currently shown)
  const summaryHtml = `<p class="catalogue-summary">${filtered.length} ${escapeHtml(t('products_count'))}`
    + ` · ${presentFamilies.length} ${escapeHtml(t('families_label'))}</p>`;

  // Family quick-nav (jump to a section) — only useful with >1 family visible
  const quicknavHtml = presentFamilies.length > 1
    ? `<nav class="famnav" aria-label="${escapeHtml(t('jump_to'))}">`
      + `<span class="famnav__label">${escapeHtml(t('jump_to'))}</span>`
      + presentFamilies.map(f =>
          `<a class="famnav__chip" href="#family-${f.id}">${escapeHtml(familyName(f))}`
          + `<span class="famnav__count">${groups[f.id].length}</span></a>`
        ).join('')
      + `</nav>`
    : '';

  const sectionsHtml = presentFamilies
    .map(f => {
      const products = groups[f.id];
      const cards = products.map(p => productCard(p)).join('');
      return `
        <section class="family-section" id="family-${f.id}">
          <header class="family-header">
            <h2 class="family-name">${escapeHtml(familyName(f))}</h2>
            <span class="family-count">${products.length} ${t('products_count')}</span>
            <button type="button" class="famzip-btn" data-family-zip="${f.id}" title="${escapeHtml(t('download_family_zip'))}">⬇ ${escapeHtml(t('datasheets_zip'))}</button>
          </header>
          <div class="${gridClass}">${cards}</div>
        </section>
      `;
    }).join('');

  container.innerHTML = summaryHtml + quicknavHtml + sectionsHtml;
  container.querySelectorAll('.famzip-btn').forEach(b =>
    b.addEventListener('click', () => downloadFamilyZip(b.dataset.familyZip, b)));
}

function setCatalogueView(view) {
  if (view !== 'grid' && view !== 'list') return;
  STATE.catalogueView = view;
  localStorage.setItem('catalogue-view', view);
  document.querySelectorAll('.view-toggle__btn').forEach(b => {
    const active = b.dataset.view === view;
    b.setAttribute('aria-pressed', String(active));
    b.classList.toggle('is-active', active);
  });
  renderCatalogue();
}

function initViewToggle() {
  document.querySelectorAll('.view-toggle__btn').forEach(b => {
    const active = b.dataset.view === STATE.catalogueView;
    b.setAttribute('aria-pressed', String(active));
    b.classList.toggle('is-active', active);
    b.addEventListener('click', () => setCatalogueView(b.dataset.view));
  });
}

// ===== Sorting =====
function productMinWatt(p) {
  const w = (p.variants || []).map(v => parseWatts(v.power)).filter(x => x !== null);
  return w.length ? Math.min(...w) : null;
}
function productMaxWatt(p) {
  const w = (p.variants || []).map(v => parseWatts(v.power)).filter(x => x !== null);
  return w.length ? Math.max(...w) : null;
}
// Returns a comparator for the given sort mode, or null to keep source order.
function productSortComparator(sort) {
  if (sort === 'name') {
    return (a, b) => a.name_slx.localeCompare(b.name_slx, undefined, { sensitivity: 'base' });
  }
  if (sort === 'power_asc') {
    return (a, b) => (productMinWatt(a) ?? Infinity) - (productMinWatt(b) ?? Infinity);
  }
  if (sort === 'power_desc') {
    return (a, b) => (productMaxWatt(b) ?? -Infinity) - (productMaxWatt(a) ?? -Infinity);
  }
  return null;
}

function setCatalogueSort(value) {
  STATE.catalogueSort = value;
  localStorage.setItem('catalogue-sort', value);
  renderCatalogue();
}

function initSortSelect() {
  const sel = document.getElementById('sort-select');
  if (!sel) return;
  const opts = [
    ['default', t('sort_default')],
    ['name', t('sort_name_asc')],
    ['power_asc', t('sort_power_asc')],
    ['power_desc', t('sort_power_desc')],
  ];
  sel.innerHTML = opts
    .map(([v, l]) => `<option value="${v}"${v === STATE.catalogueSort ? ' selected' : ''}>${escapeHtml(l)}</option>`)
    .join('');
}

function renderActiveFilters({ family, ip, ik, feat, pmin, pmax, opts }) {
  const el = document.getElementById('active-filters');
  if (!el) return;
  const chips = [];
  if (family !== 'all') {
    const f = STATE.data.families.find(x => x.id === family);
    if (f) chips.push(`${t('family')}: ${familyName(f)}`);
  }
  ip?.forEach(v => chips.push(`IP: ${v}`));
  ik?.forEach(v => chips.push(`IK: ${v}`));
  feat?.forEach(v => chips.push(v));
  const pminActive = pmin != null && opts && pmin > opts.pmin;
  const pmaxActive = pmax != null && opts && pmax < opts.pmax;
  if (pminActive || pmaxActive) {
    const lo = pminActive ? pmin : opts.pmin;
    const hi = pmaxActive ? pmax : opts.pmax;
    chips.push(`${t('power_label')}: ${lo}–${hi}W`);
  }
  if (chips.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <span class="filtered-by-label">${escapeHtml(t('filtered_by'))} :</span>
    ${chips.map(c => `<span class="filter-chip">${escapeHtml(c)}</span>`).join('')}
    <a href="catalogue.html" class="filter-clear">${escapeHtml(t('clear_filter'))}</a>
  `;
}

function renderFilterControls() {
  const el = document.getElementById('advanced-filters');
  if (!el) return;
  const opts = extractFilterOptions(STATE.data.products);
  STATE.filterOpts = opts;
  const current = getUrlFilters();

  const chipGroup = (label, key, values, currentValues) => {
    if (!values.length) return '';
    return `
      <div class="filter-group">
        <div class="filter-group__label">${escapeHtml(label)}</div>
        <div class="filter-group__chips">
          ${values.map(v => {
            const active = currentValues.includes(v);
            return `<button type="button" class="filter-chip-btn ${active ? 'is-active' : ''}" data-filter-key="${key}" data-filter-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`;
          }).join('')}
        </div>
      </div>
    `;
  };

  const anyActive = current.ip.length || current.ik.length || current.feat.length
    || (current.pmin != null && current.pmin > opts.pmin)
    || (current.pmax != null && current.pmax < opts.pmax);

  el.innerHTML = `
    <button type="button" class="filter-toggle-btn" id="filter-toggle-btn" aria-expanded="${anyActive ? 'true' : 'false'}">
      <span>${escapeHtml(t('advanced_filters'))}</span>
      <span class="filter-toggle-btn__arrow">▼</span>
    </button>
    <div class="filter-panel" id="filter-panel" ${anyActive ? '' : 'hidden'}>
      ${chipGroup(t('ip_label'), 'ip', opts.ips, current.ip)}
      ${chipGroup(t('ik_label'), 'ik', opts.iks, current.ik)}
      ${chipGroup(t('features_label'), 'feat', opts.feats, current.feat)}
      <div class="filter-group filter-group--range">
        <div class="filter-group__label">${escapeHtml(t('power_label'))} (W)</div>
        <div class="filter-range">
          <input type="number" id="filter-pmin" min="${opts.pmin}" max="${opts.pmax}" step="1" value="${current.pmin ?? opts.pmin}" />
          <span class="filter-range__sep">—</span>
          <input type="number" id="filter-pmax" min="${opts.pmin}" max="${opts.pmax}" step="1" value="${current.pmax ?? opts.pmax}" />
        </div>
      </div>
      <div class="filter-actions">
        <button type="button" class="btn btn-outline btn-sm" id="filter-reset">${escapeHtml(t('clear_filter'))}</button>
      </div>
    </div>
  `;

  const panel = document.getElementById('filter-panel');
  const toggleBtn = document.getElementById('filter-toggle-btn');
  toggleBtn.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggleBtn.setAttribute('aria-expanded', String(willOpen));
  });
  el.querySelectorAll('.filter-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('is-active');
      renderCatalogue();
    });
  });
  ['filter-pmin', 'filter-pmax'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderCatalogue);
  });
  document.getElementById('filter-reset')?.addEventListener('click', () => {
    el.querySelectorAll('.filter-chip-btn.is-active').forEach(b => b.classList.remove('is-active'));
    document.getElementById('filter-pmin').value = opts.pmin;
    document.getElementById('filter-pmax').value = opts.pmax;
    renderCatalogue();
  });
}

// ===== CSV export of product variants =====
function escapeCsvCell(value) {
  const s = String(value ?? '').replace(/[\r\n]+/g, ' ');
  // Quote if contains separator, quote, leading '=' (formula injection), or whitespace edges
  if (/[;"\n\r]/.test(s) || s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Resolve the variants-table column list for a given product.
//  - Highest priority: product.table_columns (per-product pruning written by
//    build_data.py — drops columns where every variant of this product is empty)
//  - Otherwise: families[i].table_schema → table_schemas[name]
//  - Last-resort fallback: hard-coded luminaire schema
function productTableColumns(product) {
  if (Array.isArray(product.table_columns) && product.table_columns.length) {
    return product.table_columns;
  }
  const family = STATE.data.families.find(f => f.id === product.family_id);
  const schemaName = family?.table_schema || 'luminaire';
  return (STATE.data.table_schemas && STATE.data.table_schemas[schemaName])
    || ['code_slx', 'designation', 'power', 'efficacy', 'lumen', 'weight', 'dimensions', 'voltage', 'qty_ctn'];
}

function buildCsv(product) {
  const schema = productTableColumns(product);
  const headers = STATE.data.i18n[STATE.lang].table_headers || {};
  const headerRow = schema.map(col => headers[col] || col);
  const dataRows = product.variants.map(v =>
    schema.map(col => {
      let val = v[col];
      // Multi-value cells (weight/dimensions) use '; ' internally — replace with
      // ' / ' for CSV so the ';' separator isn't ambiguous when opened in Excel.
      if ((col === 'weight' || col === 'dimensions') && typeof val === 'string') {
        val = val.replace(/;\s*/g, ' / ');
      }
      return val;
    })
  );
  const sep = ';';
  const lines = [
    headerRow.map(escapeCsvCell).join(sep),
    ...dataRows.map(row => row.map(escapeCsvCell).join(sep))
  ];
  // BOM (U+FEFF) so Excel auto-detects UTF-8 (otherwise é/° are mangled)
  const BOM = String.fromCharCode(0xFEFF);
  return BOM + lines.join('\r\n');
}

function downloadCsv(product) {
  const csv = buildCsv(product);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${product.id}-variants.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ===== Per-family datasheet ZIP (client-side, JSZip loaded on demand) =====
let _jszipPromise = null;
function ensureJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (_jszipPromise) return _jszipPromise;
  _jszipPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'assets/vendor/jszip.min.js?v=4';
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => { _jszipPromise = null; reject(new Error('JSZip load failed')); };
    document.head.appendChild(s);
  });
  return _jszipPromise;
}

async function downloadFamilyZip(familyId, btn) {
  const fam = STATE.data.families.find(f => f.id === familyId);
  if (!fam) return;
  const lang = STATE.lang;
  const files = STATE.data.products
    .filter(p => p.family_id === familyId)
    .map(p => (lang === 'fr' ? p.datasheet_fr : p.datasheet_en))
    .filter(Boolean);
  if (!files.length) return;

  const original = btn ? btn.innerHTML : '';
  const setLabel = (txt) => { if (btn) btn.textContent = txt; };
  if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
  setLabel(t('zip_preparing'));

  try {
    const JSZip = await ensureJSZip();
    const zip = new JSZip();
    let done = 0;
    await Promise.all(files.map(async (name) => {
      const res = await fetch('assets/datasheets/' + name);
      if (!res.ok) return;
      zip.file(name, await res.blob());
      done++;
      setLabel(`${done}/${files.length}`);
    }));
    const content = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
      (meta) => setLabel(Math.round(meta.percent) + '%')
    );
    const famName = (lang === 'fr' ? fam.name_fr : fam.name_en) || familyId;
    const safe = famName.replace(/[^\w\-]+/g, '_');
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SSA-${safe}-${lang.toUpperCase()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    alert(t('zip_error'));
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); btn.innerHTML = original; }
  }
}

function productWattRange(p) {
  const watts = (p.variants || []).map(v => parseWatts(v.power)).filter(w => w !== null);
  if (!watts.length) return null;
  const min = Math.min(...watts), max = Math.max(...watts);
  return min === max ? `${min} W` : `${min}–${max} W`;
}

function productIpRating(p) {
  return (p.features_fr || []).find(f => /^IP\d+K?$/i.test(f)) || null;
}

function productCard(p) {
  const family = STATE.data.families.find(f => f.id === p.family_id);
  const wattRange = productWattRange(p);
  const ip = productIpRating(p);
  // Extra fields (family chip / watt range / IP) are always rendered but
  // hidden in grid view via CSS. Only the list view exposes them.
  const listExtras = `
    <div class="product-card__meta">
      ${family ? `<span class="product-card__family">${escapeHtml(familyName(family))}</span>` : ''}
      ${wattRange ? `<span class="product-card__spec">${escapeHtml(wattRange)}</span>` : ''}
      ${ip ? `<span class="product-card__spec">${escapeHtml(ip)}</span>` : ''}
    </div>
  `;
  return `
    <a class="product-card" href="product.html?id=${encodeURIComponent(p.id)}">
      ${compareToggleMarkup(p.id)}
      <div class="product-image">
        <img src="assets/images/${p.image}" alt="${escapeHtml(p.name_slx)}" loading="lazy"
          data-fallback-code="${escapeHtml(p.code_prefix)}"
          data-fallback-label="${escapeHtml(family ? familyName(family) : '')}" />
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.name_slx)}</div>
        ${listExtras}
      </div>
      <span class="product-card__arrow" aria-hidden="true">→</span>
    </a>
  `;
}

function initFamilyFilter(selectedValue) {
  const sel = document.getElementById('family-filter');
  if (!sel) return;
  const opts = [`<option value="all">${t('all_families')}</option>`]
    .concat(STATE.data.families.map(f =>
      `<option value="${f.id}"${f.id === selectedValue ? ' selected' : ''}>${escapeHtml(familyName(f))}</option>`));
  sel.innerHTML = opts.join('');
}

function initSupplierFilter(selectedValue) {
  const sel = document.getElementById('supplier-filter');
  if (!sel) return;
  const opts = [`<option value="all">${t('all_suppliers')}</option>`]
    .concat(STATE.data.suppliers.map(s =>
      `<option value="${s.id}"${s.id === selectedValue ? ' selected' : ''}>${escapeHtml(s.name)}</option>`));
  sel.innerHTML = opts.join('');
}

// Caption for a gallery slide, inferred from its filename suffix.
function galleryCaption(file) {
  const f = (file || '').toLowerCase();
  if (/-dim\.\w+$/.test(f)) return t('cap_dimensions');
  if (/-use\.\w+$/.test(f)) return t('cap_usecase');
  return '';
}

// Product image area (datasheet-style mosaic): large main product photo on the
// left, and the dimensions + use-case visuals as labelled cards on the right.
// Falls back to a single full-width image when there is no extra gallery.
function productImageMarkup(product, family) {
  const g = (Array.isArray(product.gallery) && product.gallery.length)
    ? product.gallery : [product.image];
  const fallback = `data-fallback-code="${escapeHtml(product.code_prefix)}" data-fallback-label="${escapeHtml(family ? familyName(family) : '')}"`;
  const mainImg = `<img class="product-figure__img is-zoomable" src="assets/images/${g[0]}" alt="${escapeHtml(product.name_slx)}" ${fallback} />`;
  if (g.length <= 1) {
    return `<div class="product-figure product-figure--solo">
      <div class="product-figure__main">${mainImg}</div>
    </div>`;
  }
  // Multi-view gallery: one large main image + a strip of clickable thumbnails.
  // Clicking a thumbnail swaps the main image (see initFigureThumbs). The thumb
  // aspect ratio matches the product photos (≈4:3) so `cover` barely crops.
  const thumbs = g.map((f, i) => `
      <button type="button" class="pf-thumb${i === 0 ? ' is-active' : ''}" data-full="assets/images/${f}" aria-label="${escapeHtml(product.name_slx)} — ${i + 1}/${g.length}">
        <img src="assets/images/${f}" alt="" loading="lazy" />
      </button>`).join('');
  return `<div class="product-figure product-figure--stack">
    <div class="product-figure__main">${mainImg}</div>
    <div class="product-figure__thumbs">${thumbs}</div>
  </div>`;
}

// Wire the gallery thumbnail strip: clicking a thumb swaps the main product
// image and moves the active highlight. The main keeps its is-zoomable behavior.
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

// ===== PRODUCT page =====
function renderProduct() {
  const container = document.getElementById('product-container');
  if (!container) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const product = STATE.data.products.find(p => p.id === id);
  if (!product) {
    container.innerHTML = `<div class="empty-state">${t('product_not_found')}</div>`;
    return;
  }

  const family = STATE.data.families.find(f => f.id === product.family_id);
  const description = STATE.lang === 'fr' ? product.description_fr : product.description_en;
  const features = STATE.lang === 'fr' ? product.features_fr : product.features_en;

  const headers = t('table_headers');
  // Per-product columns (pruning of always-empty cols) → falls back to
  // family.table_schema then to the luminaire default.
  const schema = productTableColumns(product);

  // Multi-value cells (e.g. "0.5m: 4.50; 0.9m: 6.16") render one value per line.
  // Split BEFORE escaping — otherwise the ';' inside HTML entities like &quot;
  // would be incorrectly turned into <br> breaks.
  const multiline = (s) => (s || '').split(/;\s*/).map(escapeHtml).join('<br>');
  const cellHtml = (v, col) => {
    const val = v[col];
    if (col === 'weight' || col === 'dimensions') return multiline(val);
    if (col === 'power' || col === 'efficacy' || col === 'lumen') {
      // Insert <wbr> at natural break points so long values like
      // "100W(80/60 select)" or "100lm/W or 130lm/W" can soft-wrap and
      // avoid overflowing into adjacent cells.
      return escapeHtml(val)
        .replace(/\(/g, '<wbr>(')
        .replace(/ or /gi, '<wbr> or ');
    }
    return escapeHtml(val);
  };
  // Map column key → CSS class for sizing (e.g. col-code-slx).
  const colClass = (col) => 'col-' + col.replace(/_/g, '-');

  const theadHtml = schema.map(col =>
    `<th class="${colClass(col)}">${escapeHtml(headers[col] || col)}</th>`
  ).join('');
  const rows = product.variants.map(v => `
    <tr>
      ${schema.map(col => `<td class="${colClass(col)}">${cellHtml(v, col)}</td>`).join('')}
    </tr>
  `).join('');

  // Technical specifications block (from the SSA catalogue) — label/value grid.
  const techSpecs = Array.isArray(product.tech_specs) ? product.tech_specs : [];
  const techLabels = (STATE.data.i18n[STATE.lang].tech_labels) || {};
  const techHtml = techSpecs.length ? `
      <div class="product-specs-block">
        <span class="section-kicker">${escapeHtml(t('technical_specs'))}</span>
        <dl class="spec-grid">
          ${techSpecs.map(s => `
            <div class="spec-row">
              <dt>${escapeHtml(techLabels[s.k] || s.k)}</dt>
              <dd>${escapeHtml(STATE.lang === 'fr' ? s.fr : s.en)}</dd>
            </div>`).join('')}
        </dl>
      </div>` : '';

  const backUrl = `catalogue.html?family=${encodeURIComponent(product.family_id)}`;

  // Prev/next navigation within the same family (top-right of the header).
  const siblings = STATE.data.products.filter(p => p.family_id === product.family_id);
  const sIdx = siblings.findIndex(p => p.id === product.id);
  const navL = STATE.lang === 'fr'
    ? { prev: 'Produit précédent', next: 'Produit suivant' }
    : { prev: 'Previous product', next: 'Next product' };
  let navHtml = '';
  if (siblings.length > 1) {
    const prev = siblings[(sIdx - 1 + siblings.length) % siblings.length];
    const next = siblings[(sIdx + 1) % siblings.length];
    navHtml = `<nav class="product-nav" aria-label="${escapeHtml(familyName(family))}">
        <a class="product-nav__btn" href="product.html?id=${encodeURIComponent(prev.id)}" title="${escapeHtml(prev.name_slx)}" aria-label="${escapeHtml(navL.prev)}" data-nav="prev">‹</a>
        <span class="product-nav__count">${sIdx + 1} / ${siblings.length}</span>
        <a class="product-nav__btn" href="product.html?id=${encodeURIComponent(next.id)}" title="${escapeHtml(next.name_slx)}" aria-label="${escapeHtml(navL.next)}" data-nav="next">›</a>
      </nav>`;
  }

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="index.html">${escapeHtml(t('home'))}</a>
      &nbsp;›&nbsp;
      <a href="catalogue.html">${escapeHtml(t('catalogue'))}</a>
      &nbsp;›&nbsp;
      <a href="${backUrl}">${escapeHtml(familyName(family))}</a>
      &nbsp;›&nbsp;
      <span>${escapeHtml(product.name_slx)}</span>
    </div>
    <div class="product-detail product-detail--v2">
      <header class="product-head">
        <div class="product-head__main">
          <span class="product-kicker">${escapeHtml(familyName(family))}</span>
          <h1 class="product-title">${escapeHtml(product.name_slx)}</h1>
          <span class="product-accent"></span>
        </div>
        ${navHtml}
      </header>
      ${productImageMarkup(product, family)}
      ${product.specs ? `<div class="product-specs-wrap"><img class="product-specs" src="assets/images/${product.specs}" alt="${escapeHtml(product.name_slx)} — spécifications" loading="lazy" /></div>` : ''}
      <div class="product-body">
        <span class="section-kicker">${escapeHtml(t('description'))}</span>
        <p class="description">${escapeHtml(description)}</p>
        ${product.specs ? '' : `<div class="features">
          ${features.map(f => `<span class="feature-chip">${escapeHtml(f)}</span>`).join('')}
        </div>`}
        <div class="download-buttons">
          <a class="btn-download" href="assets/datasheets/${STATE.lang === 'fr' ? product.datasheet_fr : product.datasheet_en}" download>
            📄 ${escapeHtml(t('download_datasheet'))}
          </a>
          <button type="button" class="btn-download csv" id="csv-export-btn">
            📊 ${escapeHtml(t('export_csv'))}
          </button>
          <button type="button" class="btn-download alt" id="compare-product-btn"></button>
          <button type="button" class="btn-download alt" id="print-btn">🖨 ${escapeHtml(t('print'))}</button>
        </div>
      </div>
      ${techHtml}
      <div class="product-detail-bottom">
        <span class="section-kicker">${escapeHtml(t('references'))}</span>
        <div class="variants-table-wrap">
          <table class="variants-table variants-table--modern">
            <thead><tr>${theadHtml}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
    ${renderRelatedProducts(product)}
    ${renderRecentProductsBlock(product.id)}
  `;
  // Wire up the CSV export button (rendered above)
  document.getElementById('csv-export-btn')?.addEventListener('click', () => downloadCsv(product));
  // Compare toggle for this product
  const cmpBtn = document.getElementById('compare-product-btn');
  if (cmpBtn) {
    const refreshCmp = () => {
      const on = isComparing(product.id);
      cmpBtn.classList.toggle('is-active-compare', on);
      cmpBtn.innerHTML = (on ? '✓ ' : '⇄ ') + escapeHtml(on ? t('compare_added') : t('compare'));
    };
    refreshCmp();
    cmpBtn.addEventListener('click', () => { toggleCompare(product.id); refreshCmp(); });
  }
  // Print this datasheet
  document.getElementById('print-btn')?.addEventListener('click', () => window.print());
  // Keyboard arrows ←/→ jump to the prev/next product in the family.
  const navPrev = container.querySelector('.product-nav__btn[data-nav="prev"]');
  const navNext = container.querySelector('.product-nav__btn[data-nav="next"]');
  if ((navPrev || navNext) && !window.__productNavWired) {
    window.__productNavWired = true;
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target;
      if (el && el.matches && el.matches('input, textarea, select, [contenteditable]')) return;
      const lb = document.querySelector('.lightbox');
      if (lb && getComputedStyle(lb).display !== 'none') return; // don't hijack zoom
      const p = document.querySelector('.product-nav__btn[data-nav="prev"]');
      const n = document.querySelector('.product-nav__btn[data-nav="next"]');
      if (e.key === 'ArrowLeft' && p) { e.preventDefault(); location.href = p.href; }
      else if (e.key === 'ArrowRight' && n) { e.preventDefault(); location.href = n.href; }
    });
  }
  // Track this product in the recent-viewed list (after render so we don't
  // include it in its own related/recent grids on first paint).
  pushRecent(product.id);
}

function renderRecentProductsBlock(excludeId) {
  const recent = getRecentProducts(excludeId, 6);
  if (recent.length === 0) return '';
  return `
    <section class="related-section recent-section">
      <div class="related-head">
        <h2 class="related-title">${escapeHtml(t('recent_products'))}</h2>
      </div>
      <div class="product-grid">
        ${recent.map(p => productCard(p)).join('')}
      </div>
    </section>
  `;
}

function renderRelatedProducts(currentProduct) {
  const family = STATE.data.families.find(f => f.id === currentProduct.family_id);
  const related = STATE.data.products.filter(p =>
    p.family_id === currentProduct.family_id && p.id !== currentProduct.id);
  if (related.length === 0) return '';
  const MAX = 6;
  const shown = related.slice(0, MAX);
  const hasMore = related.length > MAX;
  const familyHref = `catalogue.html?family=${encodeURIComponent(currentProduct.family_id)}`;
  return `
    <section class="related-section">
      <div class="related-head">
        <h2 class="related-title">${escapeHtml(t('related_products'))}</h2>
        <a href="${familyHref}" class="related-link">${escapeHtml(familyName(family))} →</a>
      </div>
      <div class="product-grid">
        ${shown.map(p => productCard(p)).join('')}
      </div>
      ${hasMore ? `<div class="related-more"><a href="${familyHref}" class="btn btn-outline">${escapeHtml(t('see_all_family'))} →</a></div>` : ''}
    </section>
  `;
}

// ===== Compare =====
const COMPARE_KEY = 'compare';
const COMPARE_MAX = 4;

function getCompareIds() {
  try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveCompareIds(ids) {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, COMPARE_MAX)));
}
function isComparing(id) { return getCompareIds().includes(id); }

function toggleCompare(id) {
  let ids = getCompareIds();
  if (ids.includes(id)) {
    ids = ids.filter(x => x !== id);
  } else {
    if (ids.length >= COMPARE_MAX) { alert(t('compare_max')); return; }
    ids.push(id);
  }
  saveCompareIds(ids);
  syncCompareToggles();
  renderCompareBar();
}
function clearCompare() {
  saveCompareIds([]);
  syncCompareToggles();
  renderCompareBar();
}

// Reflect current selection on every compare toggle in the DOM
function syncCompareToggles() {
  const ids = getCompareIds();
  document.querySelectorAll('.compare-toggle').forEach(b => {
    const on = ids.includes(b.dataset.compareId);
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? t('compare_added') : t('compare_add');
  });
}

// Markup for the small compare toggle overlaid on a product card.
// A <span role="button"> (not <button>) keeps the HTML valid inside the card <a>.
function compareToggleMarkup(id) {
  const on = isComparing(id);
  return `<span class="compare-toggle ${on ? 'is-active' : ''}" role="button" tabindex="0"`
    + ` data-compare-id="${escapeHtml(id)}" aria-pressed="${on}"`
    + ` title="${escapeHtml(on ? t('compare_added') : t('compare_add'))}"`
    + ` aria-label="${escapeHtml(t('compare'))}">⇄</span>`;
}

function renderCompareBar() {
  let bar = document.getElementById('compare-bar');
  const ids = getCompareIds();
  const items = ids.map(id => STATE.data.products.find(p => p.id === id)).filter(Boolean);
  if (!items.length) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'compare-bar';
    bar.className = 'compare-bar';
    document.body.appendChild(bar);
  }
  const idsParam = items.map(p => encodeURIComponent(p.id)).join(',');
  bar.innerHTML = `
    <div class="compare-bar__inner">
      <span class="compare-bar__title">${escapeHtml(t('compare_bar_title'))} (${items.length})</span>
      <div class="compare-bar__items">
        ${items.map(p => `
          <span class="compare-bar__chip">
            <img src="assets/images/${p.image}" alt="" loading="lazy" />
            <span class="compare-bar__chip-name">${escapeHtml(p.name_slx)}</span>
            <button type="button" class="compare-bar__remove" data-compare-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(t('remove'))}">×</button>
          </span>`).join('')}
      </div>
      <div class="compare-bar__actions">
        <button type="button" class="btn btn-outline btn-sm" id="compare-clear-btn">${escapeHtml(t('compare_clear'))}</button>
        <a class="btn btn-primary btn-sm" href="compare.html?ids=${idsParam}">${escapeHtml(t('compare_view'))} (${items.length})</a>
      </div>
    </div>`;
}

// One delegated listener handles toggles on cards, removes + clear on the bar.
let compareWired = false;
function initCompare() {
  if (!compareWired) {
    compareWired = true;
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('.compare-toggle');
      if (toggle) { e.preventDefault(); e.stopPropagation(); toggleCompare(toggle.dataset.compareId); return; }
      const rem = e.target.closest('.compare-bar__remove');
      if (rem) { e.preventDefault(); toggleCompare(rem.dataset.compareId); return; }
      const cr = e.target.closest('.compare-remove');
      if (cr) {
        e.preventDefault();
        toggleCompare(cr.dataset.compareId);
        if (document.getElementById('compare-container')) renderCompare();
        return;
      }
      if (e.target.closest('#compare-clear-btn')) {
        e.preventDefault();
        clearCompare();
        if (document.getElementById('compare-container')) renderCompare();
      }
    });
    // keyboard support for the span/role=button toggles
    document.addEventListener('keydown', (e) => {
      const cls = e.target.classList;
      if (!cls) return;
      if ((e.key === 'Enter' || e.key === ' ') && cls.contains('compare-toggle')) {
        e.preventDefault(); e.stopPropagation();
        toggleCompare(e.target.dataset.compareId);
      } else if ((e.key === 'Enter' || e.key === ' ') && cls.contains('compare-remove')) {
        e.preventDefault();
        toggleCompare(e.target.dataset.compareId);
        if (document.getElementById('compare-container')) renderCompare();
      }
    });
  }
  renderCompareBar();
  syncCompareToggles();
}

// ===== COMPARE page (compare.html) =====
function parseNum(s) {
  if (s == null) return null;
  const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function fieldRange(p, field, parser) {
  const vals = (p.variants || []).map(v => parser(v[field])).filter(x => x !== null && !isNaN(x));
  if (!vals.length) return null;
  return { mn: Math.min(...vals), mx: Math.max(...vals) };
}
function fmtRange(r, unit) {
  if (!r) return '—';
  const u = unit || '';
  return r.mn === r.mx ? `${r.mn}${u}` : `${r.mn}–${r.mx}${u}`;
}

function renderCompare() {
  const container = document.getElementById('compare-container');
  if (!container) return;
  const params = new URLSearchParams(location.search);
  const ids = (params.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
  // keep the bar/localStorage in sync with what's shown
  if (ids.length) saveCompareIds(ids);
  const products = ids.map(id => STATE.data.products.find(p => p.id === id)).filter(Boolean);

  const heading = `<h1 class="section-title">${escapeHtml(t('compare_title'))}</h1>`;

  if (!products.length) {
    container.innerHTML = `${heading}
      <div class="empty-state">
        <p>${escapeHtml(t('compare_empty'))}</p>
        <p style="margin-top:16px;"><a class="btn btn-primary" href="catalogue.html">${escapeHtml(t('catalogue'))}</a></p>
      </div>`;
    return;
  }

  const familyOf = (p) => STATE.data.families.find(f => f.id === p.family_id);
  const ip = (p) => productIpRating(p) || '—';
  const feats = (p) => (STATE.lang === 'fr' ? p.features_fr : p.features_en) || [];

  // Build attribute rows: [label, valueFn returning HTML]
  const rows = [
    [t('family'), p => escapeHtml(familyName(familyOf(p)) || '—')],
    [t('power_label'), p => escapeHtml(fmtRange(fieldRange(p, 'power', parseWatts), ' W'))],
    [t('table_headers.lumen'), p => escapeHtml(fmtRange(fieldRange(p, 'lumen', parseNum), ' lm'))],
    [t('table_headers.efficacy'), p => escapeHtml(fmtRange(fieldRange(p, 'efficacy', parseNum), ' lm/W'))],
    ['IP', p => escapeHtml(ip(p))],
    [t('compare_variants'), p => String((p.variants || []).length)],
    [t('features'), p => feats(p).slice(0, 8).map(f => `<span class="feature-chip">${escapeHtml(f)}</span>`).join(' ')],
    [t('download_datasheet'), p => {
      const ds = STATE.lang === 'fr' ? p.datasheet_fr : p.datasheet_en;
      return ds ? `<a class="btn-download alt" href="assets/datasheets/${ds}" download>📄 PDF</a>` : '—';
    }],
  ];

  const head = `<th class="compare-attr-head">${escapeHtml(t('compare_attribute'))}</th>` + products.map(p => `
    <th class="compare-prod-head">
      <span class="compare-remove" role="button" tabindex="0" data-compare-id="${escapeHtml(p.id)}" aria-label="${escapeHtml(t('remove'))}">×</span>
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="compare-prod-link">
        <span class="compare-prod-img"><img src="assets/images/${p.image}" alt="${escapeHtml(p.name_slx)}" loading="lazy" /></span>
        <span class="compare-prod-name">${escapeHtml(p.name_slx)}</span>
      </a>
    </th>`).join('');

  const body = rows.map(([label, fn]) => `
    <tr>
      <th class="compare-attr">${escapeHtml(label)}</th>
      ${products.map(p => `<td>${fn(p)}</td>`).join('')}
    </tr>`).join('');

  container.innerHTML = `
    <div class="compare-head-row">
      ${heading}
      <button type="button" class="btn btn-outline btn-sm" id="compare-clear-btn">${escapeHtml(t('compare_clear'))}</button>
    </div>
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

// ===== Scroll reveal (subtle fade-in) — home only =====
// Progressive enhancement: if IntersectionObserver is missing or the user
// prefers reduced motion, nothing is hidden and the page renders as-is.
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const selector = [
    '.featured-inner',
    '.browse-section .section-head',
    '.family-rich-grid > *',
    '.featured-products-section .section-head',
    '.featured-products-grid > *',
  ].join(', ');
  const targets = Array.from(document.querySelectorAll(selector));
  if (!targets.length) return;
  document.body.classList.add('reveal-enabled');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('reveal--in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  targets.forEach(el => { el.classList.add('reveal'); io.observe(el); });
}

// ===== Image lightbox (product page) =====
function openLightbox(src, alt) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.innerHTML = `<button type="button" class="lightbox__close" aria-label="Close">×</button>`
      + `<img class="lightbox__img" alt="" />`;
    document.body.appendChild(lb);
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('lightbox__close')) closeLightbox();
    });
  }
  const img = lb.querySelector('.lightbox__img');
  img.src = src;
  img.alt = alt || '';
  lb.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('is-open');
  document.body.style.overflow = '';
}
let lightboxWired = false;
function initImageLightbox() {
  if (!lightboxWired) {
    lightboxWired = true;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  }
  const imgs = document.querySelectorAll('.product-figure img, .product-detail-image img');
  imgs.forEach((img) => {
    img.classList.add('is-zoomable');
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
  });
}

// Product gallery: large main image swapped by clicking thumbnails
// (photo + dimensions + use-case). Everything visible at once, no auto-scroll.
function initGallery() {
  const g = document.querySelector('.product-gallery');
  if (!g) return;
  const main = g.querySelector('.gallery-main-img');
  const thumbs = Array.from(g.querySelectorAll('.gallery-thumb'));
  if (!main || thumbs.length < 2) return;
  const show = (i) => {
    const tb = thumbs[i];
    if (!tb) return;
    main.src = tb.dataset.src;
    thumbs.forEach((d, j) => {
      const active = j === i;
      d.classList.toggle('is-active', active);
      if (active) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  };
  thumbs.forEach((d, j) => d.addEventListener('click', () => show(j)));
}

// ===== Entry points =====
let renderPage = null;

function initHeaderScroll() {
  const header = document.getElementById('site-header');
  if (!header || !header.classList.contains('site-header--transparent')) return;
  const onScroll = () => {
    header.classList.toggle('site-header--solid', window.scrollY > 80);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Global search bar in the home hero: live suggestions + submit -> catalogue?q=
function initHeroSearch() {
  const form = document.getElementById('hero-search');
  if (!form) return;
  const input = document.getElementById('hero-search-input');
  const box = document.getElementById('hero-search-suggestions');
  const goCatalogue = (q) => {
    location.href = 'catalogue.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  };
  const matchesFor = (q) => STATE.data.products.filter(p =>
    p.name_slx.toLowerCase().includes(q) ||
    p.variants.some(v => (v.code_slx || '').toLowerCase().includes(q)
                      || (v.designation || '').toLowerCase().includes(q))
  );
  const renderSuggestions = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    const matches = matchesFor(q).slice(0, 6);
    if (!matches.length) {
      box.innerHTML = `<div class="hero-suggestion hero-suggestion--empty">${escapeHtml(t('no_suggestions'))}</div>`;
      box.hidden = false; return;
    }
    box.innerHTML = matches.map(p => {
      const fam = STATE.data.families.find(f => f.id === p.family_id);
      return `<a class="hero-suggestion" href="product.html?id=${encodeURIComponent(p.id)}">
        <span class="hero-suggestion__img"><img src="assets/images/${p.image}" alt="" loading="lazy" /></span>
        <span class="hero-suggestion__name">${escapeHtml(p.name_slx)}</span>
        <span class="hero-suggestion__fam">${escapeHtml(fam ? familyName(fam) : '')}</span>
      </a>`;
    }).join('');
    box.hidden = false;
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); goCatalogue(input.value.trim()); });
  input.addEventListener('input', renderSuggestions);
  input.addEventListener('focus', renderSuggestions);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { box.hidden = true; } });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) box.hidden = true; });
}

async function initHome() {
  await loadData();
  initLangSwitch();
  applyStaticI18n();
  renderHome();
  initHeaderScroll();
  initBackToTop();
  initCompare();
  initScrollReveal();
  initHeroSearch();
  renderPage = () => {
    applyStaticI18n();
    renderHome();
    renderCompareBar();
    initScrollReveal();
  };
}

async function initCatalogue() {
  await loadData();
  initLangSwitch();
  const url = getUrlFilters();
  initFamilyFilter(url.family);
  applyStaticI18n();
  const sInput = document.getElementById('search-input');
  if (sInput && url.q) sInput.value = url.q;

  sInput?.addEventListener('input', renderCatalogue);
  document.getElementById('family-filter')?.addEventListener('change', renderCatalogue);
  initSortSelect();
  document.getElementById('sort-select')?.addEventListener('change', e => setCatalogueSort(e.target.value));

  renderFilterControls();
  initViewToggle();
  renderCatalogue();
  initBackToTop();
  initCompare();

  renderPage = () => {
    const familyVal = document.getElementById('family-filter')?.value || 'all';
    initFamilyFilter(familyVal);
    initSortSelect();
    applyStaticI18n();
    renderFilterControls();
    renderCatalogue();
    renderCompareBar();
    syncCompareToggles();
  };
}

async function initProduct() {
  await loadData();
  initLangSwitch();
  applyStaticI18n();
  renderProduct();
  initBackToTop();
  initCompare();
  initGallery();
  initFigureThumbs();
  initImageLightbox();
  renderPage = () => {
    applyStaticI18n();
    renderProduct();
    renderCompareBar();
    syncCompareToggles();
    initGallery();
    initImageLightbox();
  };
}

async function initComparePage() {
  await loadData();
  initLangSwitch();
  applyStaticI18n();
  renderCompare();
  initBackToTop();
  initCompare();
  renderPage = () => {
    applyStaticI18n();
    renderCompare();
    renderCompareBar();
  };
}
