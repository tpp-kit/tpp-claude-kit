#!/usr/bin/env node
// Mantiene una sola fuente de verdad para lo que se repite entre archivos:
//  1. shared/cargar-reglas.mjs se copia a plugins/<p>/hooks/ de cada plugin que tiene reglas/.
//  2. El repo de kit.config.json se escribe en los instaladores, el README y el ONBOARDING.
//
// Uso:  node scripts/sincronizar.mjs          → escribe
//       node scripts/sincronizar.mjs --check  → solo verifica; sale con 1 si algo difiere (CI)

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const config = JSON.parse(readFileSync(join(RAIZ, 'kit.config.json'), 'utf8'));
const problemas = [];

function asegurar(ruta, contenido) {
  const actual = existsSync(ruta) ? readFileSync(ruta, 'utf8') : null;
  if (actual === contenido) return;
  if (CHECK) { problemas.push(`desactualizado: ${ruta.slice(RAIZ.length + 1)}`); return; }
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido);
  console.log(`actualizado: ${ruta.slice(RAIZ.length + 1)}`);
}

// 1. Copias del cargador de reglas
const cargador = readFileSync(join(RAIZ, 'shared', 'cargar-reglas.mjs'), 'utf8');
for (const p of readdirSync(join(RAIZ, 'plugins'))) {
  if (existsSync(join(RAIZ, 'plugins', p, 'reglas'))) {
    asegurar(join(RAIZ, 'plugins', p, 'hooks', 'cargar-reglas.mjs'), cargador);
  }
}

// 2. El repo del kit en los archivos que lo repiten
const repo = config.repo;
const reemplazos = [
  ['install/instalar-mac.sh', /^KIT_REPO=".*"$/m, `KIT_REPO="${repo}"`],
  ['install/instalar-windows.ps1', /^\$KitRepo = ".*"$/m, `$KitRepo = "${repo}"`],
  ['plugins/tpp/scripts/doctor.mjs', /^export const REPO_OFICIAL = '.*';$/m, `export const REPO_OFICIAL = '${repo}';`],
  // Solo "dueño/repo": así no toca `claude plugin marketplace add ./` (prueba local) ni la puntuación de alrededor.
  ['README.md', /(claude plugin marketplace add )[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g, `$1${repo}`],
  ['ONBOARDING.md', /(claude plugin marketplace add )[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g, `$1${repo}`],
];
for (const [archivo, patron, valor] of reemplazos) {
  const ruta = join(RAIZ, archivo);
  if (!existsSync(ruta)) { problemas.push(`falta ${archivo}`); continue; }
  asegurar(ruta, readFileSync(ruta, 'utf8').replace(patron, valor));
}

if (problemas.length) {
  console.error('sincronizar --check encontró diferencias. Corré `node scripts/sincronizar.mjs` y commiteá:');
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}
if (CHECK) console.log('sincronizar: todo coincide con shared/ y kit.config.json');
