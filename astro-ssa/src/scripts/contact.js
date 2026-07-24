// Page Contact : le formulaire ouvre un mail pré-rempli vers contact@ssa.green.
import './common.js';

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'contact-form') return;
  e.preventDefault();
  const lang = window.SSA.lang;
  const f = Object.fromEntries(new FormData(e.target).entries());
  const subject = lang === 'en' ? `Contact — ${f.name || ''}` : `Contact — ${f.name || ''}`;
  const coord = [
    f.name && `${lang === 'en' ? 'Name' : 'Nom'}: ${f.name}`,
    f.company && `${lang === 'en' ? 'Company' : 'Société'}: ${f.company}`,
    f.email && `Email: ${f.email}`,
    f.phone && `${lang === 'en' ? 'Phone' : 'Téléphone'}: ${f.phone}`,
  ].filter(Boolean).join('\n');
  const body = `${coord}\n\n${f.message || ''}`;
  location.href = `mailto:contact@ssa.green?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
