// Script partagé (toutes pages) : i18n client sur DOM pré-rendu, bascule langue,
// header au scroll, back-to-top, lightbox. Expose window.SSA pour les autres pages.
import { icon } from '../lib/icons.js';
const I18N = (typeof window !== 'undefined' && window.__I18N__) || {};
const STATE = { lang: 'fr' };
try { STATE.lang = localStorage.getItem('ssa-lang') || 'fr'; } catch (e) {}

function t(key) {
  const d = I18N[STATE.lang] || I18N.fr || {};
  return key.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), d) ?? key;
}

// Applique la langue courante sur le DOM :
//  - [data-i18n]              → textContent depuis le dictionnaire i18n
//  - [data-i18n-placeholder]  → placeholder
//  - [data-fr]/[data-en]      → textContent bilingue (contenu produit)
//  - [data-href-fr]/[data-href-en] → href bilingue (liens fiches PDF)
function applyI18n() {
  document.documentElement.lang = STATE.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-fr]').forEach((el) => {
    el.textContent = STATE.lang === 'en' ? (el.dataset.en || el.dataset.fr) : el.dataset.fr;
  });
  document.querySelectorAll('[data-href-fr]').forEach((el) => {
    const h = STATE.lang === 'en' ? (el.dataset.hrefEn || el.dataset.hrefFr) : el.dataset.hrefFr;
    if (h) el.setAttribute('href', h);
  });
  document.querySelectorAll('.lang-switch button').forEach((b) => b.classList.toggle('active', b.dataset.lang === STATE.lang));
  document.dispatchEvent(new CustomEvent('ssa:langchange', { detail: { lang: STATE.lang } }));
}

function setLang(l) {
  STATE.lang = l;
  try { localStorage.setItem('ssa-lang', l); } catch (e) {}
  applyI18n();
}

function initLang() {
  document.querySelectorAll('.lang-switch button').forEach((b) =>
    b.addEventListener('click', () => setLang(b.dataset.lang)));
  applyI18n();
}

function initHeaderScroll() {
  const h = document.getElementById('site-header');
  if (!h || !h.classList.contains('site-header--transparent')) return;
  const f = () => h.classList.toggle('site-header--solid', window.scrollY > 80);
  f();
  window.addEventListener('scroll', f, { passive: true });
}

function initBackToTop() {
  if (document.getElementById('back-to-top')) return;
  const btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Haut de page');
  btn.innerHTML = '↑';
  document.body.appendChild(btn);
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  const onScroll = () => btn.classList.toggle('visible', window.scrollY > 500);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ── Lightbox (fiche produit) ──
function openLightbox(src, alt) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.innerHTML = '<button type="button" class="lightbox__close" aria-label="Close">×</button><img class="lightbox__img" alt="" />';
    document.body.appendChild(lb);
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('lightbox__close')) closeLightbox();
    });
  }
  const img = lb.querySelector('.lightbox__img');
  img.src = src; img.alt = alt || '';
  lb.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('is-open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

// Placeholder image stylé quand une photo manque (produits sans photo).
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.dataset.fallbackCode && !img.dataset.fallbackApplied) {
    img.dataset.fallbackApplied = '1';
    const ph = document.createElement('div');
    ph.className = 'image-placeholder';
    ph.innerHTML = `<div class="image-placeholder__code">${img.dataset.fallbackCode}</div>`
      + (img.dataset.fallbackLabel ? `<div class="image-placeholder__label">${img.dataset.fallbackLabel}</div>` : '');
    img.replaceWith(ph);
  }
}, true);

// Compteur de références du devis dans l'en-tête (badge).
function updateDevisBadge() {
  const el = document.getElementById('header-devis-count');
  if (!el) return;
  let n = 0;
  try { n = (JSON.parse(localStorage.getItem('devis') || '[]') || []).length; } catch (e) {}
  el.textContent = String(n);
  el.hidden = n === 0;
}

initLang();
initHeaderScroll();
initBackToTop();
updateDevisBadge();

// Charge products.json une seule fois (mémoïsé) — pour recherche hero & comparateur.
let _dataPromise = null;
function loadData() {
  if (!_dataPromise) _dataPromise = fetch('/assets/products.json').then((r) => r.json());
  return _dataPromise;
}

window.SSA = {
  t,
  get lang() { return STATE.lang; },
  openLightbox,
  closeLightbox,
  loadData,
  applyI18n,
  icon,
  updateDevisBadge,
  onLangChange(cb) { document.addEventListener('ssa:langchange', (e) => cb(e.detail.lang)); },
};
