#!/usr/bin/env node
// Escribe o reemplaza un bloque del kit TPP en un archivo de instrucciones de la persona, con respaldo previo.
//
// Solo tres destinos: el archivo que lee Claude Code (perfil personal) y los que leen Codex y Gemini (reglas).
// Cada tipo usa sus propias marcas, así el perfil y las reglas conviven aunque CLAUDE.md, AGENTS.md y GEMINI.md
// sean el mismo archivo (symlinks). Lo que la persona tenga fuera de las marcas no se toca.
//
// Uso:  node escribir-bloque.mjs --destino claude|codex|gemini --desde <archivo en la carpeta temporal> [--simular]
// Sale con 0 y un JSON { destino, respaldo, accion } en stdout.
//
// HARDENING (auditoría ofensiva y Codex 2026-11-26):
//  - --desde solo acepta archivos de la carpeta temporal: antes copiaba cualquier archivo, ~/.claude.json incluido.
//  - el contenido no puede traer credenciales (lo revisa el detector de tpp-guardrails; sin él, no se escribe).
//  - el destino se resuelve con sus symlinks y tiene que quedar dentro de la carpeta personal.
//  - marcas distintas por tipo: antes escribir las reglas de Codex pisaba el perfil de Claude si eran el mismo archivo.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, realpathSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TIPO = { claude: 'PERFIL', codex: 'REGLAS', gemini: 'REGLAS' };
const MAX_BYTES = 64 * 1024;

export function marcas(destino) {
  const tipo = TIPO[destino];
  if (!tipo) throw new Error(`destino desconocido: ${destino}`);
  return { inicio: `<!-- KIT-TPP:${tipo}:INICIO -->`, fin: `<!-- KIT-TPP:${tipo}:FIN -->` };
}

export function destinos(home = homedir()) {
  return {
    claude: join(home, '.claude', 'CLAUDE.md'),
    codex: join(home, '.codex', 'AGENTS.md'),
    gemini: join(home, '.gemini', 'GEMINI.md'),
  };
}

export function reemplazarBloque(actual, contenido, destino = 'claude') {
  const { inicio, fin } = marcas(destino);
  if (/<!--\s*KIT-TPP:/.test(contenido)) throw new Error('el contenido no puede traer marcas del kit');
  const bloque = `${inicio}\n${contenido.trim()}\n${fin}`;
  const i = actual.indexOf(inicio);
  const f = actual.indexOf(fin);
  if (i === -1 && f === -1) {
    const base = actual.replace(/\s*$/, '');
    return { texto: base ? `${base}\n\n${bloque}\n` : `${bloque}\n`, accion: 'agregado' };
  }
  if (i === -1 || f === -1 || f < i || actual.indexOf(inicio, i + 1) !== -1 || actual.indexOf(fin, f + 1) !== -1) {
    throw new Error('las marcas del kit están incompletas o repetidas; revisá el archivo a mano');
  }
  return { texto: actual.slice(0, i) + bloque + actual.slice(f + fin.length), accion: 'reemplazado' };
}

const dentroDe = (ruta, raiz) => { const r = resolve(raiz); const p = resolve(ruta); return p === r || p.startsWith(r + sep); };

/** El origen tiene que ser un archivo chico dentro de la carpeta temporal del sistema. */
export function validarOrigen(desde) {
  if (!desde || !existsSync(desde)) throw new Error('--desde debe apuntar a un archivo que exista');
  const real = realpathSync(desde);
  const temporales = [tmpdir(), '/tmp', '/private/tmp'].filter(existsSync).map((t) => realpathSync(t));
  if (!temporales.some((t) => dentroDe(real, t))) throw new Error('--desde tiene que estar en la carpeta temporal del sistema');
  if (!statSync(real).isFile() || statSync(real).size > MAX_BYTES) throw new Error('--desde tiene que ser un archivo de menos de 64 KB');
  return real;
}

/** Resuelve el destino siguiendo symlinks y exige que quede dentro de la carpeta personal. */
export function validarDestino(ruta, home = homedir()) {
  const real = existsSync(ruta) ? realpathSync(ruta) : resolve(ruta);
  if (!dentroDe(real, realpathSync(home))) throw new Error('el destino resuelve fuera de tu carpeta personal; no se escribe');
  return real;
}

// El detector vive en tpp-guardrails. Se busca en la instalación activa y, si se corre desde el repo del kit,
// en su ruta fija dentro del repo. No hay variable de entorno para cambiarlo: sería una válvula de escape.
async function detectorDeCredenciales() {
  const { pluginsActivos } = await import('./doctor.mjs');
  const candados = pluginsActivos().plugins['tpp-guardrails'];
  const opciones = [
    candados?.ruta && join(candados.ruta, 'hooks', 'secretos-pegados.mjs'),
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tpp-guardrails', 'hooks', 'secretos-pegados.mjs'),
  ].filter(Boolean);
  const ruta = opciones.find((r) => existsSync(r));
  return ruta ? (await import(pathToFileURL(ruta).href)).detectar : null;
}

function arg(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? null : process.argv[i + 1];
}

async function main() {
  const destino = arg('destino');
  const rutas = destinos();
  if (!Object.hasOwn(rutas, destino)) throw new Error(`--destino debe ser uno de: ${Object.keys(rutas).join(', ')}`);
  const contenido = readFileSync(validarOrigen(arg('desde')), 'utf8');
  const detectar = await detectorDeCredenciales();
  if (!detectar) throw new Error('no encuentro los candados (tpp-guardrails) para revisar el contenido; instalalos y repetí');
  const hallado = detectar(contenido);
  if (hallado) throw new Error(`el contenido parece tener una credencial (${hallado}); no se escribe`);
  const ruta = validarDestino(rutas[destino]);
  const actual = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
  const { texto, accion } = reemplazarBloque(actual, contenido, destino);
  let respaldo = null;
  const simular = process.argv.includes('--simular');
  if (!simular) {
    mkdirSync(dirname(ruta), { recursive: true });
    if (existsSync(ruta)) {
      respaldo = `${ruta}.kit-tpp-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
      copyFileSync(ruta, respaldo);
    }
    writeFileSync(ruta, texto);
  }
  process.stdout.write(JSON.stringify({ destino: ruta, respaldo, accion, simulado: simular }));
}

function esPrincipal() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (esPrincipal()) {
  main().catch((e) => { process.stderr.write(`escribir-bloque: ${e.message}\n`); process.exit(1); });
}
