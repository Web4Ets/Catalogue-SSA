// Envoi d'un formulaire vers /send.php (PHP hébergé sur IONOS).
// En cas d'échec (script absent, hors-ligne, aperçu local sans PHP), on se
// replie sur le mail pré-rempli (mailto) pour ne jamais perdre la demande.
export async function sendForm({ subject, body, replyEmail = '', replyName = '', honeypot = '', mailto = '', lang = 'fr', type = 'contact', fields = {} }) {
  try {
    const params = new URLSearchParams({
      subject: subject || '',
      body: body || '',
      email: replyEmail || '',
      name: replyName || '',
      company_url: honeypot || '',
      lang: lang || 'fr',
      type: type || 'contact',
    });
    // Champs structurés supplémentaires (téléphone, société, message, items…).
    for (const [k, v] of Object.entries(fields)) {
      params.set(k, v == null ? '' : String(v));
    }
    const res = await fetch('/send.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params,
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.ok) return { ok: true };
    }
  } catch (e) {
    /* réseau indisponible / script absent → repli mailto ci-dessous */
  }
  if (mailto) {
    try { window.location.href = mailto; } catch (e) { /* ignore */ }
  }
  return { ok: false };
}
