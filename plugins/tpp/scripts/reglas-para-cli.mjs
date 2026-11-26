#!/usr/bin/env node
// Arma el texto de reglas del kit para Codex CLI y Gemini CLI, que no corren los hooks de Claude.
// Junta las reglas del plugin base y de los plugins de equipo instalados, leyendo las rutas de
// ~/.claude/plugins/installed_plugins.json. Es la misma fuente que carga Claude: no se copian a mano.
//
// Uso:  node reglas-para-cli.mjs > reglas.md

import { existsSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pluginsInstalados } from './doctor.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));

export async function textoReglas() {
  const instalados = pluginsInstalados();
  const raices = [join(AQUI, '..')];
  for (const [nombre, p] of Object.entries(instalados)) {
    if (nombre !== 'tpp' && p.habilitado && p.ruta && existsSync(join(p.ruta, 'reglas'))) raices.push(p.ruta);
  }
  const partes = [
    '# Kit TPP — reglas de trabajo',
    'Estas reglas vienen del kit de Claude de TPP. Se actualizan corriendo /tpp:bienvenida en Claude Code.',
    'En esta herramienta NO conectes los conectores de Meta, Google ni TikTok Ads: acá no hay candados de solo lectura.',
  ];
  for (const raiz of raices) {
    const { armarContexto } = await import(pathToFileURL(join(raiz, 'hooks', 'cargar-reglas.mjs')).href);
    const t = armarContexto(join(raiz, 'reglas'));
    if (t) partes.push(t);
  }
  return partes.join('\n\n');
}

function esPrincipal() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (esPrincipal()) {
  textoReglas().then((t) => process.stdout.write(`${t}\n`)).catch((e) => { process.stderr.write(`reglas-para-cli: ${e.message}\n`); process.exit(1); });
}
