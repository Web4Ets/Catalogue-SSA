// Panier de devis au niveau RÉFÉRENCE (code SSA). Un « + » par ligne du tableau
// des références ajoute cette référence ; boutons produit/carte ajoutent toutes
// les références du produit. Barre flottante → page /devis/.
import './common.js';

const KEY = 'devis';
const t = (k) => window.SSA.t(k);

const getItems = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
const saveItems = (items) => localStorage.setItem(KEY, JSON.stringify(items));
const hasRef = (code) => getItems().some((i) => i.code === code);
const hasProduct = (id) => getItems().some((i) => i.id === id);

let _products = [];
window.SSA.loadData().then((d) => { _products = d.products; syncButtons(); renderBar(); });

const codesOf = (id) => { const p = _products.find((x) => x.id === id); return p ? p.variants.map((v) => v.code_slx) : []; };

function toggleRef(id, code) {
  let items = getItems();
  items = hasRef(code) ? items.filter((i) => i.code !== code) : [...items, { id, code }];
  saveItems(items); syncButtons(); renderBar();
}
function toggleProduct(id) {
  let items = getItems();
  const codes = codesOf(id);
  if (items.some((i) => i.id === id)) items = items.filter((i) => i.id !== id);            // retirer tout le produit
  else { const have = new Set(items.map((i) => i.code)); codes.forEach((c) => { if (!have.has(c)) items.push({ id, code: c }); }); }
  saveItems(items); syncButtons(); renderBar();
}
function clearQuote() { saveItems([]); syncButtons(); renderBar(); }

function syncButtons() {
  // « + » par ligne de référence
  document.querySelectorAll('[data-devis-ref]').forEach((btn) => {
    const [, code] = btn.dataset.devisRef.split('|');
    const on = hasRef(code);
    btn.classList.toggle('is-active-quote', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? t('in_quote') : t('add_to_quote');
    btn.innerHTML = window.SSA.icon(on ? 'check' : 'plus');
  });
  // boutons produit / carte
  document.querySelectorAll('[data-devis-id]').forEach((btn) => {
    const on = hasProduct(btn.dataset.devisId);
    btn.classList.toggle('is-active-quote', on);
    if (btn.hasAttribute('data-devis-compact')) {
      btn.setAttribute('aria-pressed', String(on));
      btn.title = on ? t('in_quote') : t('add_to_quote');
      btn.innerHTML = window.SSA.icon(on ? 'check' : 'quote');
    } else {
      btn.innerHTML = window.SSA.icon(on ? 'check' : 'quote') + ' <span>' + (on ? t('in_quote') : t('add_to_quote')) + '</span>';
    }
  });
}

function renderBar() {
  window.SSA.updateDevisBadge();
  let bar = document.getElementById('devis-bar');
  const items = getItems();
  if (!items.length) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'devis-bar'; bar.className = 'devis-bar'; document.body.appendChild(bar); }
  const nProd = new Set(items.map((i) => i.id)).size;
  bar.innerHTML = `
    <div class="devis-bar__inner">
      <span class="devis-bar__title">${window.SSA.icon('quote')} ${t('quote_bar_title')} (${items.length})</span>
      <span class="devis-bar__summary">${items.length} ${t('references').toLowerCase()} · ${nProd} ${t('products_count')}</span>
      <div class="devis-bar__actions">
        <button type="button" class="btn btn-outline btn-sm" id="devis-clear-btn">${t('quote_clear')}</button>
        <a class="btn btn-primary btn-sm" href="/devis/">${t('request_quote')} (${items.length})</a>
      </div>
    </div>`;
}

document.addEventListener('click', (e) => {
  const ref = e.target.closest('[data-devis-ref]');
  if (ref) { e.preventDefault(); e.stopPropagation(); const [id, code] = ref.dataset.devisRef.split('|'); toggleRef(id, code); return; }
  const prod = e.target.closest('[data-devis-id]');
  if (prod) { e.preventDefault(); toggleProduct(prod.dataset.devisId); return; }
  if (e.target.closest('#devis-clear-btn')) { e.preventDefault(); clearQuote(); }
});
window.SSA.onLangChange(() => { syncButtons(); renderBar(); });

syncButtons();
window.SSA_devis = { toggleRef, toggleProduct, clearQuote, getItems, hasRef, hasProduct };
