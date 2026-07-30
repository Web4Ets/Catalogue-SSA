// Page Contact : le formulaire envoie directement le message à contact@ssa.green
// via /send.php (repli sur le mail pré-rempli si le serveur ne répond pas).
import './common.js';
import { sendForm } from './send-form.js';

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'contact-form') return;
  e.preventDefault();
  const form = e.target;
  const lang = window.SSA.lang;
  const f = Object.fromEntries(new FormData(form).entries());
  const subject = `Contact — ${f.name || ''}`.trim();
  const coord = [
    f.name && `${lang === 'en' ? 'Name' : 'Nom'}: ${f.name}`,
    f.company && `${lang === 'en' ? 'Company' : 'Société'}: ${f.company}`,
    f.email && `Email: ${f.email}`,
    f.phone && `${lang === 'en' ? 'Phone' : 'Téléphone'}: ${f.phone}`,
  ].filter(Boolean).join('\n');
  const body = `${coord}\n\n${f.message || ''}`;
  const mailto = `mailto:contact@ssa.green?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const btn = form.querySelector('button[type="submit"]');
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = lang === 'en' ? 'Sending…' : 'Envoi…'; }

  const res = await sendForm({ subject, body, replyEmail: f.email, replyName: f.name, honeypot: f.company_url, mailto, lang, type: 'contact' });

  if (res.ok) {
    form.innerHTML = `<div class="form-success">
      <strong>${lang === 'en' ? 'Message sent!' : 'Message envoyé !'}</strong>
      <p>${lang === 'en' ? 'Thank you, our team will get back to you shortly.' : 'Merci, notre équipe vous répond au plus vite.'}</p>
    </div>`;
  } else if (btn) {
    btn.disabled = false; btn.innerHTML = label;
  }
});
