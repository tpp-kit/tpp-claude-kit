#!/usr/bin/env node
// Activa la actualización automática del kit TPP en la configuración de usuario de Claude Code
// (~/.claude/settings.json → extraKnownMarketplaces["tpp-claude-kit"].autoUpdate = true).
//
// Toma el origen del marketplace de ~/.claude/plugins/known_marketplaces.json (lo que dejó
// `claude plugin marketplace add`), respalda settings.json y no toca ninguna otra clave.
// Si settings.json no es JSON válido, no escribe nada.
//
// Uso:  node activar-actualizacion.mjs [--simular]

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKETPLACE, origenDelKit } from './doctor.mjs';

export function estadoActualizacion(home = homedir()) {
  let settings = null, conocidos = null;
  try { settings = JSON.parse(readFileSync(join(home, '.claude', 'settings.json'), 'utf8')); } catch { /* sin settings */ }
  try { conocidos = JSON.parse(readFileSync(join(home, '.claude', 'plugins', 'known_marketplaces.json'), 'utf8')); } catch { /* sin marketplaces */ }
  return {
    registrado: !!conocidos?.[MARKETPLACE],
    origen: conocidos?.[MARKETPLACE]?.source || null,
    activa: settings?.extraKnownMarketplaces?.[MARKETPLACE]?.autoUpdate === true || conocidos?.[MARKETPLACE]?.autoUpdate === true,
  };
}

export function conActualizacion(settings, origen) {
  const nuevo = { ...settings };
  const previos = nuevo.extraKnownMarketplaces && typeof nuevo.extraKnownMarketplaces === 'object' ? nuevo.extraKnownMarketplaces : {};
  nuevo.extraKnownMarketplaces = { ...previos, [MARKETPLACE]: { ...(previos[MARKETPLACE] || {}), source: origen, autoUpdate: true } };
  return nuevo;
}

function main() {
  const home = homedir();
  const estado = estadoActualizacion(home);
  if (!estado.registrado || !estado.origen) throw new Error(`el marketplace ${MARKETPLACE} no está registrado; corré primero el instalador del kit`);
  // Solo se activa la actualización automática del kit OFICIAL: activarla en una copia ajena dejaría
  // que esa copia se actualice sola para siempre.
  const origen = origenDelKit(home);
  if (origen.estado !== 'oficial') throw new Error(`no se activa la actualización: ${origen.detalle}. Mandale este mensaje a Guie.`);
  if (estado.activa) { process.stdout.write(JSON.stringify({ accion: 'ya-activa' })); return; }
  const ruta = join(home, '.claude', 'settings.json');
  let settings = {};
  if (existsSync(ruta)) {
    try { settings = JSON.parse(readFileSync(ruta, 'utf8')); }
    catch { throw new Error('~/.claude/settings.json no es JSON válido; no se tocó. Revisalo a mano.'); }
  }
  const nuevo = conActualizacion(settings, estado.origen);
  let respaldo = null;
  if (!process.argv.includes('--simular')) {
    mkdirSync(dirname(ruta), { recursive: true });
    if (existsSync(ruta)) {
      respaldo = `${ruta}.kit-tpp-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
      copyFileSync(ruta, respaldo);
    }
    writeFileSync(ruta, `${JSON.stringify(nuevo, null, 2)}\n`);
  }
  process.stdout.write(JSON.stringify({ accion: 'activada', respaldo, simulado: process.argv.includes('--simular') }));
}

function esPrincipal() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (esPrincipal()) {
  try { main(); } catch (e) { process.stderr.write(`activar-actualizacion: ${e.message}\n`); process.exit(1); }
}
