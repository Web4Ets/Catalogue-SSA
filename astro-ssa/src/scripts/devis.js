// Panier de devis (partagé) : « Ajouter au devis » accumule des produits, une
// barre flottante liste la sélection, « Demander le devis » ouvre un mail
// pré-rempli listant tous les produits (nom + code SSA + lien fiche).
import './common.js';

const KEY = 'devis';
const t = (k) => window.SSA.t(k);
const ORIGIN = location.origin;

const getIds = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
const saveIds = (ids) => localStorage.setItem(KEY, JSON.stringify(ids));
const inQuote = (id) => getIds().includes(id);

let _products = [];
window.SSA.loadData().then((d) => { _products = d.products; renderBar(); syncButtons(); });

function toggle(id) {
  let ids = getIds();
  ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  saveIds(ids); syncButtons(); renderBar();
}
function clearQuote() { saveIds([]); syncButtons(); renderBar(); }

function firstCode(p) { return (p.variants && p.variants[0] && p.variants[0].code_slx) || p.code_prefix || ''; }

function buildMailto() {
  const lang = window.SSA.lang;
  const items = getIds().map((id) => _products.find((p) => p.id === id)).filter(Boolean);
  const subject = lang === 'en' ? `Quote request — ${items.length} product(s)` : `Demande de devis — ${items.length} produit(s)`;
  const intro = lang === 'en'
    ? 'Hello,\n\nI would like a quote for the following products:\n'
    : 'Bonjour,\n\nJe souhaite recevoir un devis pour les produits suivants :\n';
  const lines = items.map((p) => `- ${p.name_slx} (${lang === 'en' ? 'SSA code' : 'code SSA'} ${firstCode(p)}) — ${ORIGIN}/produit/${p.id}/`);
  const outro = lang === 'en' ? '\n\nThank you.' : '\n\nMerci.';
  const body = intro + lines.join('\n') + outro;
  return `mailto:ssa@ssa.green?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Boutons « Ajouter au devis » (fiche produit + cartes le cas échéant).
function syncButtons() {
  document.querySelectorAll('[data-devis-id]').forEach((btn) => {
    const on = inQuote(btn.dataset.devisId);
    btn.classList.toggle('is-active-quote', on);
    const label = on ? t('in_quote') : t('add_to_quote');
    const iconEl = btn.querySelector('.icon');
    btn.innerHTML = window.SSA.icon(on ? 'check' : 'quote') + ' <span>' + label + '</span>';
  });
}

function renderBar() {
  let bar = document.getElementById('devis-bar');
  const items = getIds().map((id) => _products.find((p) => p.id === id)).filter(Boolean);
  if (!items.length) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'devis-bar'; bar.className = 'devis-bar'; document.body.appendChild(bar); }
  bar.innerHTML = `
    <div class="devis-bar__inner">
      <span class="devis-bar__title">${window.SSA.icon('quote')} ${t('quote_bar_title')} (${items.length})</span>
      <div class="devis-bar__items">
        ${items.map((p) => `
          <span class="devis-bar__chip">
            <img src="/assets/images/${p.image}" alt="" loading="lazy" />
            <span class="devis-bar__chip-name">${p.name_slx}</span>
            <button type="button" class="devis-bar__remove" data-devis-remove="${p.id}" aria-label="${t('remove')}">×</button>
          </span>`).join('')}
      </div>
      <div class="devis-bar__actions">
        <button type="button" class="btn btn-outline btn-sm" id="devis-clear-btn">${t('quote_clear')}</button>
        <a class="btn btn-primary btn-sm" id="devis-send" href="${buildMailto()}">${t('request_quote')} (${items.length})</a>
      </div>
    </div>`;
}

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-devis-id]');
  if (add) { e.preventDefault(); toggle(add.dataset.devisId); return; }
  const rem = e.target.closest('[data-devis-remove]');
  if (rem) { e.preventDefault(); toggle(rem.dataset.devisRemove); return; }
  if (e.target.closest('#devis-clear-btn')) { e.preventDefault(); clearQuote(); }
});
window.SSA.onLangChange(() => { syncButtons(); renderBar(); });

syncButtons();
window.SSA_devis = { toggle, clearQuote, getIds, inQuote };
