// Comparateur (partagé accueil/catalogue/fiche) : toggles sur cartes + barre
// flottante. Porté depuis l'ancien script.js. localStorage, max 4.
const COMPARE_KEY = 'compare';
const COMPARE_MAX = 4;
const t = (k) => (window.SSA ? window.SSA.t(k) : k);

const getIds = () => { try { return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'); } catch (e) { return []; } };
const saveIds = (ids) => localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, COMPARE_MAX)));
const isComparing = (id) => getIds().includes(id);

let _products = [];
window.SSA?.loadData?.().then((d) => { _products = d.products; renderBar(); syncToggles(); });

function toggleCompare(id) {
  let ids = getIds();
  if (ids.includes(id)) ids = ids.filter((x) => x !== id);
  else { if (ids.length >= COMPARE_MAX) { alert(t('compare_max')); return; } ids.push(id); }
  saveIds(ids); syncToggles(); renderBar();
}
function clearCompare() { saveIds([]); syncToggles(); renderBar(); }

function syncToggles() {
  const ids = getIds();
  document.querySelectorAll('.compare-toggle').forEach((b) => {
    const on = ids.includes(b.dataset.compareId);
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? t('compare_added') : t('compare_add');
  });
}

function renderBar() {
  let bar = document.getElementById('compare-bar');
  const ids = getIds();
  const items = ids.map((id) => _products.find((p) => p.id === id)).filter(Boolean);
  if (!items.length) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'compare-bar'; bar.className = 'compare-bar'; document.body.appendChild(bar); }
  const idsParam = items.map((p) => encodeURIComponent(p.id)).join(',');
  bar.innerHTML = `
    <div class="compare-bar__inner">
      <span class="compare-bar__title">${t('compare_bar_title')} (${items.length})</span>
      <div class="compare-bar__items">
        ${items.map((p) => `
          <span class="compare-bar__chip">
            <img src="/assets/images/${p.image}" alt="" loading="lazy" />
            <span class="compare-bar__chip-name">${p.name_slx}</span>
            <button type="button" class="compare-bar__remove" data-compare-id="${p.id}" aria-label="${t('remove')}">×</button>
          </span>`).join('')}
      </div>
      <div class="compare-bar__actions">
        <button type="button" class="btn btn-outline btn-sm" id="compare-clear-btn">${t('compare_clear')}</button>
        <a class="btn btn-primary btn-sm" href="/comparer/?ids=${idsParam}">${t('compare_view')} (${items.length})</a>
      </div>
    </div>`;
}

document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.compare-toggle');
  if (toggle) { e.preventDefault(); e.stopPropagation(); toggleCompare(toggle.dataset.compareId); return; }
  const rem = e.target.closest('.compare-bar__remove');
  if (rem) { e.preventDefault(); toggleCompare(rem.dataset.compareId); return; }
  if (e.target.closest('#compare-clear-btn')) { e.preventDefault(); clearCompare(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('compare-toggle')) {
    e.preventDefault(); e.stopPropagation(); toggleCompare(e.target.dataset.compareId);
  }
});
window.SSA?.onLangChange?.(() => { syncToggles(); renderBar(); });

syncToggles();
window.SSA_compare = { toggleCompare, clearCompare, getIds, isComparing };
