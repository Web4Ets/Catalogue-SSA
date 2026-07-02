// Déploiement FTP du dossier dist/ vers IONOS.
// Prérequis : `npm run build` (génère dist/) puis identifiants dans .env (voir .env.example).
// Usage : npm run deploy
import { Client } from 'basic-ftp';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASTRO = join(HERE, '..');
const DIST = join(ASTRO, 'dist');

// mini-parseur .env (évite une dépendance)
const envPath = join(ASTRO, '.env');
if (!existsSync(envPath)) { console.error('✗ Fichier .env manquant. Copiez .env.example en .env et renseignez vos identifiants IONOS.'); process.exit(1); }
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
if (!existsSync(DIST)) { console.error('✗ dist/ absent. Lancez `npm run build` d’abord.'); process.exit(1); }
if (!env.FTP_HOST || !env.FTP_USER) { console.error('✗ FTP_HOST/FTP_USER manquants dans .env'); process.exit(1); }

const client = new Client(30000);
client.ftp.verbose = false;
try {
  await client.access({
    host: env.FTP_HOST,
    user: env.FTP_USER,
    password: env.FTP_PASSWORD,
    secure: String(env.FTP_SECURE).toLowerCase() === 'true',
  });
  const remote = env.FTP_REMOTE_DIR || '/';
  console.log(`→ Upload dist/ vers ${env.FTP_HOST}:${remote} …`);
  client.trackProgress((info) => { if (info.name) process.stdout.write(`  ${info.type} ${info.name}\r`); });
  await client.ensureDir(remote);
  await client.clearWorkingDir().catch(() => {}); // repart propre (optionnel)
  await client.uploadFromDir(DIST);
  console.log('\n✓ Déploiement terminé.');
} catch (e) {
  console.error('\n✗ Échec du déploiement :', e.message);
  process.exitCode = 1;
} finally {
  client.close();
}
