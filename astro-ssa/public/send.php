<?php
// Réception des formulaires du site (Contact + Devis) et envoi du mail à SSA.
// Hébergement IONOS classique = PHP dispo. Aucun service tiers, aucune base.
// Le mail interne (→ contact@ssa.green) est un email HTML brandé (multipart :
// texte + HTML). Un accusé de réception HTML part au visiteur (best-effort).

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

// Honeypot anti-spam : champ caché qui doit rester vide (les bots le remplissent).
if (!empty($_POST['company_url'])) {
    echo json_encode(['ok' => true]); // succès silencieux, on n'envoie rien
    exit;
}

$post = function ($k, $d = '') { return isset($_POST[$k]) ? (string) $_POST[$k] : $d; };

$to      = 'contact@ssa.green';
$subject = $post('subject', 'Message du site SSA');
$body    = $post('body');            // version texte (secours + mailto)
$email   = $post('email');
$name    = $post('name');
$company = $post('company');
$phone   = $post('phone');
$message = $post('message');
$lang    = ($post('lang') === 'en') ? 'en' : 'fr';
$type    = ($post('type') === 'devis') ? 'devis' : 'contact';
$items   = json_decode($post('items', '[]'), true);
if (!is_array($items)) { $items = []; }

if (trim($body) === '' && trim($message) === '' && !count($items)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'empty']);
    exit;
}

// Anti-injection d'en-têtes : on retire tout retour chariot des champs d'en-tête.
$clean = function ($s) {
    return trim(str_replace(["\r", "\n", '%0a', '%0d', '%0A', '%0D'], '', (string) $s));
};
$subject   = $clean($subject);
$name      = $clean($name);
$email     = $clean($email);
$replyAddr = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';

$fromName = 'Site SSA';
$fromAddr = 'contact@ssa.green';

// Échappement HTML.
$h = function ($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); };

// ---------- Gabarit d'email HTML brandé SSA ----------
$emailShell = function ($heading, $contentHtml) use ($h) {
    $year = date('Y');
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:0;background:#f2efe9;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe9;padding:24px 12px;"><tr><td align="center">'
        . '<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e9e5dc;">'
        . '<tr><td style="background:#1d1d1b;padding:20px 28px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        . '<td style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">SSA</td>'
        . '<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#f7a600;text-transform:uppercase;letter-spacing:1.5px;">Solutions Solaires Adaptées</td>'
        . '</tr></table></td></tr>'
        . '<tr><td style="height:4px;background:#f7a600;font-size:0;line-height:0;">&nbsp;</td></tr>'
        . '<tr><td style="padding:26px 28px 4px;"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.3;color:#1d1d1b;">' . $heading . '</h1></td></tr>'
        . '<tr><td style="padding:12px 28px 26px;font-family:Arial,Helvetica,sans-serif;">' . $contentHtml . '</td></tr>'
        . '<tr><td style="padding:16px 28px;background:#faf8f3;border-top:1px solid #e9e5dc;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#969696;">'
        . 'Envoyé depuis <a href="https://ssa.green" style="color:#9a6700;text-decoration:none;">ssa.green</a> &middot; &copy; ' . $year . ' SSA — Solutions Solaires Adaptées</td></tr>'
        . '</table></td></tr></table></body></html>';
};

// Tableau clé/valeur (coordonnées).
$kvTable = function ($rows) {
    $html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d1d1b;margin:0 0 4px;">';
    foreach ($rows as $r) {
        if ($r[1] === '' || $r[1] === null) { continue; }
        $html .= '<tr>'
            . '<td style="padding:9px 12px;background:#faf8f3;border:1px solid #e9e5dc;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#757572;width:32%;vertical-align:top;">' . $r[0] . '</td>'
            . '<td style="padding:9px 12px;border:1px solid #e9e5dc;">' . $r[2] . '</td>'
            . '</tr>';
    }
    return $html . '</table>';
};

// ---------- Contenu du mail interne (→ SSA) ----------
$L = [
    'fr' => ['newDevis' => 'Nouvelle demande de devis', 'newMsg' => 'Nouveau message de contact',
             'coord' => 'Coordonnées', 'name' => 'Nom', 'company' => 'Société', 'email' => 'Email',
             'phone' => 'Téléphone', 'refs' => 'Références demandées', 'product' => 'Produit',
             'code' => 'Code', 'qty' => 'Qté', 'message' => 'Message'],
    'en' => ['newDevis' => 'New quote request', 'newMsg' => 'New contact message',
             'coord' => 'Contact details', 'name' => 'Name', 'company' => 'Company', 'email' => 'Email',
             'phone' => 'Phone', 'refs' => 'Requested references', 'product' => 'Product',
             'code' => 'Code', 'qty' => 'Qty', 'message' => 'Message'],
][$lang];

$heading = ($type === 'devis') ? $L['newDevis'] : $L['newMsg'];

$emailLink = $replyAddr !== '' ? '<a href="mailto:' . $h($replyAddr) . '" style="color:#9a6700;text-decoration:none;">' . $h($replyAddr) . '</a>' : '';
$phoneLink = $phone !== '' ? '<a href="tel:' . $h(preg_replace('/\s+/', '', $phone)) . '" style="color:#1d1d1b;text-decoration:none;">' . $h($phone) . '</a>' : '';

$content  = '<p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9a6700;font-weight:bold;">' . $L['coord'] . '</p>';
$content .= $kvTable([
    [$L['name'], $name, $h($name)],
    [$L['company'], $company, $h($company)],
    [$L['email'], $replyAddr, $emailLink],
    [$L['phone'], $phone, $phoneLink],
]);

if ($type === 'devis' && count($items)) {
    $content .= '<p style="margin:22px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9a6700;font-weight:bold;">' . $L['refs'] . '</p>';
    $content .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d1d1b;">';
    $content .= '<tr>'
        . '<th align="left" style="padding:9px 12px;background:#1d1d1b;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:.6px;">' . $L['product'] . '</th>'
        . '<th align="left" style="padding:9px 12px;background:#1d1d1b;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:.6px;">' . $L['code'] . '</th>'
        . '<th align="right" style="padding:9px 12px;background:#1d1d1b;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:.6px;">' . $L['qty'] . '</th>'
        . '</tr>';
    $i = 0;
    foreach ($items as $it) {
        $bg = ($i % 2 === 0) ? '#ffffff' : '#faf8f3';
        $pname = isset($it['name']) ? $h($it['name']) : '';
        $pcode = isset($it['code']) ? $h($it['code']) : '';
        $pqty  = isset($it['qty']) ? (int) $it['qty'] : 1;
        $content .= '<tr>'
            . '<td style="padding:9px 12px;border-bottom:1px solid #e9e5dc;background:' . $bg . ';">' . $pname . '</td>'
            . '<td style="padding:9px 12px;border-bottom:1px solid #e9e5dc;background:' . $bg . ';font-family:Consolas,Menlo,monospace;">' . $pcode . '</td>'
            . '<td align="right" style="padding:9px 12px;border-bottom:1px solid #e9e5dc;background:' . $bg . ';font-weight:bold;">' . $pqty . '</td>'
            . '</tr>';
        $i++;
    }
    $content .= '</table>';
}

if (trim($message) !== '') {
    $content .= '<p style="margin:22px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9a6700;font-weight:bold;">' . $L['message'] . '</p>';
    $content .= '<div style="padding:14px 16px;background:#faf8f3;border-left:4px solid #f7a600;border-radius:0 8px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1d1d1b;">' . nl2br($h($message)) . '</div>';
}

$htmlInternal = $emailShell($heading, $content);

// Version texte de secours : on réutilise le corps déjà formaté par le front.
$textInternal = ($body !== '') ? $body : $heading;

// ---------- Envoi multipart (texte + HTML) au format email ----------
$sendMail = function ($dest, $subj, $textPart, $htmlPart) use ($fromName, $fromAddr, $replyAddr, $name) {
    $boundary = 'ssa_' . md5(uniqid('', true));
    $headers  = "From: {$fromName} <{$fromAddr}>\r\n";
    if ($replyAddr !== '') {
        $replyName = $name !== '' ? $name : $replyAddr;
        $headers .= "Reply-To: {$replyName} <{$replyAddr}>\r\n";
    }
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";

    $encSubj = '=?UTF-8?B?' . base64_encode($subj) . '?=';
    $msg  = "--{$boundary}\r\n";
    $msg .= "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n";
    $msg .= $textPart . "\r\n\r\n";
    $msg .= "--{$boundary}\r\n";
    $msg .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n";
    $msg .= $htmlPart . "\r\n\r\n";
    $msg .= "--{$boundary}--";

    return @mail($dest, $encSubj, $msg, $headers, "-f {$fromAddr}");
};

$sent = $sendMail($to, $subject, $textInternal, $htmlInternal);

// ---------- Accusé de réception au visiteur (HTML, best-effort) ----------
if ($sent && $replyAddr !== '') {
    if ($lang === 'en') {
        $ackSubject = $type === 'devis' ? 'We received your quote request — SSA' : 'We received your message — SSA';
        $ackHeading = $type === 'devis' ? 'Your quote request has been received' : 'Your message has been received';
        $greeting   = $name !== '' ? 'Hello ' . $h($name) . ',' : 'Hello,';
        $intro      = $type === 'devis'
            ? 'Thank you for your quote request. Our team will prepare your quote and get back to you shortly.'
            : 'Thank you for your message. Our team will get back to you shortly.';
        $recapLabel = 'Copy of your request';
        $signature  = 'The SSA team';
    } else {
        $ackSubject = $type === 'devis' ? 'Votre demande de devis a bien été reçue — SSA' : 'Votre message a bien été reçu — SSA';
        $ackHeading = $type === 'devis' ? 'Votre demande de devis a bien été reçue' : 'Votre message a bien été reçu';
        $greeting   = $name !== '' ? 'Bonjour ' . $h($name) . ',' : 'Bonjour,';
        $intro      = $type === 'devis'
            ? 'Merci pour votre demande de devis. Notre équipe la prépare et revient vers vous rapidement.'
            : 'Merci pour votre message. Notre équipe vous répondra dans les meilleurs délais.';
        $recapLabel = 'Copie de votre demande';
        $signature  = "L'équipe SSA";
    }

    $ackContent  = '<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1d1d1b;">' . $greeting . '</p>';
    $ackContent .= '<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1b;">' . $h($intro) . '</p>';
    $ackContent .= '<p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1d1d1b;">' . $h($signature) . '</p>';
    $ackContent .= '<p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9a6700;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">' . $recapLabel . '</p>';
    $ackContent .= '<div style="padding:14px 16px;background:#faf8f3;border-left:4px solid #f7a600;border-radius:0 8px 8px 0;font-family:Consolas,Menlo,monospace;font-size:13px;line-height:1.6;color:#1d1d1b;white-space:pre-wrap;">' . $h($body) . '</div>';

    $ackHtml = $emailShell($ackHeading, $ackContent);
    $ackText = $greeting . "\n\n" . $intro . "\n\n" . $signature . "\n\n----------\n" . $body;

    $sendMail($replyAddr, $ackSubject, $ackText, $ackHtml);
}

if ($sent) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail']);
}
