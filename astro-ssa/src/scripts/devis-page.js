// Page /devis/ : liste les références ajoutées (depuis localStorage), permet de
// retirer, saisir ses coordonnées, et envoyer la demande par email (mailto).
import './common.js';
import './devis.js';
import { sendForm } from './send-form.js';

const t = (k) => window.SSA.t(k);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function render() {
  const container = document.getElementById('devis-container');
  if (!container) return;
  const DATA = await window.SSA.loadData();
  const lang = window.SSA.lang;
  const items = window.SSA_devis.getItems();
  const heading = `<h1 class="section-title">${t('quote_bar_title')}</h1>`;

  if (!items.length) {
    container.innerHTML = `${heading}<div class="empty-state"><p>${t('quote_empty')}</p>
      <p style="margin-top:16px;"><a class="btn btn-primary" href="/catalogue/">${t('catalogue')}</a></p></div>`;
    return;
  }

  // Regroupe les références par produit, en récupérant le détail du variant.
  const byProduct = new Map();
  for (const it of items) {
    const p = DATA.products.find((x) => x.id === it.id);
    if (!p) continue;
    const v = p.variants.find((x) => x.code_slx === it.code);
    if (!v) continue;
    if (!byProduct.has(p.id)) byProduct.set(p.id, { p, rows: [] });
    byProduct.get(p.id).rows.push({ v, qty: it.qty || 1 });
  }

  const th = (c) => (DATA.i18n[lang].table_headers || {})[c] || c;
  const qtyLabel = lang === 'en' ? 'Qty' : 'Qté';
  const groups = [...byProduct.values()].map(({ p, rows }) => `
    <div class="devis-group">
      <div class="devis-group__head">
        <img src="/assets/images/${p.image}" alt="" loading="lazy" />
        <a href="/produit/${p.id}/" class="devis-group__name">${esc(p.name_slx)}</a>
      </div>
      <table class="devis-table">
        <thead><tr><th>${th('code_slx')}</th><th>${th('designation')}</th><th>${th('power')}</th><th class="devis-qty-col">${qtyLabel}</th><th></th></tr></thead>
        <tbody>
          ${rows.map(({ v, qty }) => `<tr>
            <td class="devis-code">${esc(v.code_slx)}</td>
            <td>${esc(v.designation || '')}</td>
            <td>${esc(v.power || '')}</td>
            <td class="devis-qty-col"><input type="number" class="devis-qty" min="1" step="1" value="${qty}" data-qty-code="${esc(v.code_slx)}" aria-label="${qtyLabel} ${esc(v.code_slx)}" /></td>
            <td><button type="button" class="devis-remove" data-remove-code="${esc(v.code_slx)}" aria-label="${t('remove')}">×</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('');

  const form = `
    <form class="devis-form" id="devis-form">
      <h2 class="devis-form__title">${lang === 'en' ? 'Your details' : 'Vos coordonnées'}</h2>
      <div class="devis-form__grid">
        <label>${lang === 'en' ? 'Name' : 'Nom'} <input type="text" name="name" required /></label>
        <label>${lang === 'en' ? 'Company' : 'Société'} <input type="text" name="company" /></label>
        <label>${lang === 'en' ? 'Email' : 'Email'} <input type="email" name="email" required /></label>
        <label>${lang === 'en' ? 'Phone' : 'Téléphone'} <input type="tel" name="phone" /></label>
      </div>
      <label class="devis-form__msg">${lang === 'en' ? 'Message' : 'Message'} <textarea name="message" rows="3"></textarea></label>
      <input type="text" name="company_url" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button type="submit" class="btn btn-primary btn-lg">${t('request_quote')} (${items.length})</button>
      <p class="devis-form__note">${lang === 'en' ? 'Sent straight to our team.' : 'Envoyé directement à notre équipe.'}</p>
    </form>`;

  container.innerHTML = `
    <div class="devis-head-row">${heading}
      <button type="button" class="btn btn-outline btn-sm" id="devis-clear-all">${t('quote_clear')}</button>
    </div>
    <div class="devis-layout">
      <div class="devis-list">${groups}</div>
      <div class="devis-side">${form}</div>
    </div>`;
}

function buildMessage(fields) {
  const DATA = window.__DATA_CACHE__ || {};
  const lang = window.SSA.lang;
  const items = window.SSA_devis.getItems();
  const subject = lang === 'en' ? `Quote request — ${items.length} reference(s)` : `Demande de devis — ${items.length} référence(s)`;
  const qtyWord = lang === 'en' ? 'qty' : 'qté';
  const lines = items.map((it) => {
    const p = (DATA.products || []).find((x) => x.id === it.id);
    return `- ${p ? p.name_slx : ''} · ${it.code} · ${qtyWord} ${it.qty || 1}`;
  });
  const intro = lang === 'en' ? 'Hello,\n\nI would like a quote for the following references:\n' : 'Bonjour,\n\nJe souhaite un devis pour les références suivantes :\n';
  const coord = [
    fields.name && `${lang === 'en' ? 'Name' : 'Nom'}: ${fields.name}`,
    fields.company && `${lang === 'en' ? 'Company' : 'Société'}: ${fields.company}`,
    fields.email && `Email: ${fields.email}`,
    fields.phone && `${lang === 'en' ? 'Phone' : 'Téléphone'}: ${fields.phone}`,
  ].filter(Boolean).join('\n');
  const msg = fields.message ? `\n\n${fields.message}` : '';
  const body = intro + lines.join('\n') + '\n\n' + coord + msg + (lang === 'en' ? '\n\nThank you.' : '\n\nMerci.');
  return { subject, body };
}
function buildMailto(fields) {
  const { subject, body } = buildMessage(fields);
  return `mailto:contact@ssa.green?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

document.addEventListener('click', (e) => {
  const rem = e.target.closest('[data-remove-code]');
  if (rem) {
    const code = rem.dataset.removeCode;
    const it = window.SSA_devis.getItems().find((x) => x.code === code);
    if (it) window.SSA_devis.toggleRef(it.id, code);
    render();
  }
  if (e.target.closest('#devis-clear-all')) { window.SSA_devis.clearQuote(); render(); }
});
document.addEventListener('change', (e) => {
  const q = e.target.closest('.devis-qty');
  if (q) window.SSA_devis.setQty(q.dataset.qtyCode, q.value);
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'devis-form') return;
  e.preventDefault();
  const form = e.target;
  const lang = window.SSA.lang;
  const fields = Object.fromEntries(new FormData(form).entries());
  const { subject, body } = buildMessage(fields);
  const mailto = buildMailto(fields);

  const btn = form.querySelector('button[type="submit"]');
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = lang === 'en' ? 'Sending…' : 'Envoi…'; }

  const res = await sendForm({ subject, body, replyEmail: fields.email, replyName: fields.name, honeypot: fields.company_url, mailto, lang, type: 'devis' });

  if (res.ok) {
    window.SSA_devis.clearQuote();
    const container = document.getElementById('devis-container');
    if (container) {
      container.innerHTML = `<div class="form-success">
        <strong>${lang === 'en' ? 'Request sent!' : 'Demande envoyée !'}</strong>
        <p>${lang === 'en' ? 'Thank you, we will prepare your quote and get back to you.' : 'Merci, nous préparons votre devis et revenons vers vous rapidement.'}</p>
        <p style="margin-top:16px;"><a class="btn btn-primary" href="/catalogue/">${t('catalogue')}</a></p>
      </div>`;
    }
  } else if (btn) {
    btn.disabled = false; btn.innerHTML = label;
  }
});
window.SSA.loadData().then((d) => { window.__DATA_CACHE__ = d; });
window.SSA.onLangChange(render);
render();
