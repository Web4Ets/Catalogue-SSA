// Synchronise les données et assets SERVIS du site racine vers le projet Astro.
// Source de vérité = repo racine (généré par build_data.py / generate_datasheets.py).
// On ne copie QUE ce qui doit être déployé : products.json, style.css, et les
// assets servis (images WebP, datasheets, brand, fonts, vendor). Les dossiers
// sources PNG (P2/, "NN NN NN/") NE sont PAS copiés (dev only).
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASTRO = join(HERE, '..');
const ROOT = join(ASTRO, '..');

function copyDir(src, dst, filter = () => true) {
  if (!existsSync(src)) { console.warn('! absent:', src); return 0; }
  mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const name of readdirSync(src)) {
    const s = join(src, name), d = join(dst, name);
    const st = statSync(s);
    if (st.isDirectory()) n += copyDir(s, d, filter);
    else if (filter(s, name)) { copyFileSync(s, d); n++; }
  }
  return n;
}
function copyFile(src, dst) {
  if (!existsSync(src)) { console.warn('! absent:', src); return; }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

// 1) données
copyFile(join(ROOT, 'data', 'products.json'), join(ASTRO, 'src', 'data', 'products.json'));
// 2) CSS global
copyFile(join(ROOT, 'style.css'), join(ASTRO, 'public', 'style.css'));

// 3) assets servis → public/assets (on repart propre)
const pubAssets = join(ASTRO, 'public', 'assets');
rmSync(pubAssets, { recursive: true, force: true });

// images : uniquement les .webp à la racine de assets/images (pas les dossiers sources PNG)
const imgSrc = join(ROOT, 'assets', 'images');
const imgDst = join(pubAssets, 'images');
mkdirSync(imgDst, { recursive: true });
let imgN = 0;
for (const name of readdirSync(imgSrc)) {
  const s = join(imgSrc, name);
  if (statSync(s).isFile() && name.toLowerCase().endsWith('.webp')) { copyFileSync(s, join(imgDst, name)); imgN++; }
}

const dN = copyDir(join(ROOT, 'assets', 'datasheets'), join(pubAssets, 'datasheets'), (_, n) => n.toLowerCase().endsWith('.pdf'));
const bN = copyDir(join(ROOT, 'assets', 'brand'), join(pubAssets, 'brand'));
const fN = copyDir(join(ROOT, 'assets', 'fonts'), join(pubAssets, 'fonts'));
const vN = copyDir(join(ROOT, 'assets', 'vendor'), join(pubAssets, 'vendor'));

console.log(`sync OK — images:${imgN} datasheets:${dN} brand:${bN} fonts:${fN} vendor:${vN}`);
