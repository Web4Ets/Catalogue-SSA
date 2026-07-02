// Accueil : recherche hero (suggestions live → /catalogue/?q=), scroll-reveal.
import './common.js'; // garantit window.SSA prêt avant tout usage (ordre ES modules)
import './compare.js';

const familyName = (fam, lang) => (fam ? (lang === 'en' ? fam.name_en : fam.name_fr) : '');

function haystack(p, families, lang) {
  const fam = families.find((f) => f.id === p.family_id);
  const parts = [p.name_slx, familyName(fam, lang)];
  for (const v of p.variants) parts.push(v.code_slx, v.designation, v.power, v.lumen, v.cct);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function initHeroSearch() {
  const form = document.getElementById('hero-search');
  if (!form) return;
  const input = document.getElementById('hero-search-input');
  const box = document.getElementById('hero-search-suggestions');
  let DATA = null;
  window.SSA.loadData().then((d) => { DATA = d; });

  const render = () => {
    const q = input.value.trim().toLowerCase();
    if (!DATA || q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    const lang = window.SSA.lang;
    const matches = DATA.products
      .filter((p) => (haystack(p, DATA.families, 'fr') + ' ' + haystack(p, DATA.families, 'en')).includes(q))
      .slice(0, 6);
    if (!matches.length) {
      box.innerHTML = `<div class="hero-suggestion hero-suggestion--empty">${window.SSA.t('no_suggestions')}</div>`;
      box.hidden = false; return;
    }
    box.innerHTML = matches.map((p) => {
      const fam = DATA.families.find((f) => f.id === p.family_id);
      return `<a class="hero-suggestion" href="/produit/${encodeURIComponent(p.id)}/">
        <span class="hero-suggestion__img"><img src="/assets/images/${p.image}" alt="" loading="lazy" /></span>
        <span class="hero-suggestion__name">${p.name_slx}</span>
        <span class="hero-suggestion__fam">${familyName(fam, lang)}</span>
      </a>`;
    }).join('');
    box.hidden = false;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    location.href = '/catalogue/' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.hidden = true; });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) box.hidden = true; });
}

function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = Array.from(document.querySelectorAll('.featured-inner, .browse-section .section-head, .family-rich-grid > *, .featured-products-section .section-head, .featured-products-grid > *'));
  if (!targets.length) return;
  document.body.classList.add('reveal-enabled');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('reveal--in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
}

initHeroSearch();
initScrollReveal();
