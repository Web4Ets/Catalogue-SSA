<?php
// Réception des formulaires du site (Contact + Devis) et envoi du mail à SSA.
// Hébergement IONOS classique = PHP dispo. Aucun service tiers, aucune base.
// Le front poste en AJAX (fetch) subject/body/email/name + un honeypot.

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

$to      = 'contact@ssa.green';
$subject = isset($_POST['subject']) ? (string) $_POST['subject'] : 'Message du site SSA';
$body    = isset($_POST['body'])    ? (string) $_POST['body']    : '';
$email   = isset($_POST['email'])   ? (string) $_POST['email']   : '';
$name    = isset($_POST['name'])    ? (string) $_POST['name']    : '';

if (trim($body) === '') {
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

$headers  = "From: {$fromName} <{$fromAddr}>\r\n";
if ($replyAddr !== '') {
    $replyName = $name !== '' ? $name : $replyAddr;
    $headers .= "Reply-To: {$replyName} <{$replyAddr}>\r\n";
}
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";

// Sujet encodé (RFC 2047) pour préserver les accents.
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sent = @mail($to, $encodedSubject, $body, $headers, "-f {$fromAddr}");

if ($sent) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail']);
}
