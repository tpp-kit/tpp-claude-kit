#!/usr/bin/env node
// Hook SessionStart de tpp-guardrails: deja una marca en el contexto de la sesión que prueba que Claude
// está EJECUTANDO los hooks de este plugin (no solo que el plugin está instalado). /tpp:diagnostico y
// /tpp:bienvenida buscan esta marca: si no aparece, los candados no están corriendo en esta sesión.
// Además comprueba que la lista permitida se pueda leer.

import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARCA_LATIDO = 'CANDADOS-TPP-ACTIVOS';

function esPrincipal() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (esPrincipal()) {
  let estado;
  try {
    const lista = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ads-readonly-allowlist.json'), 'utf8'));
    const total = Object.values(lista.servers || {}).reduce((n, t) => n + (Array.isArray(t) ? t.length : 0), 0);
    estado = `${MARCA_LATIDO}: los candados de tpp-guardrails corren en esta sesión (lista de solo lectura con ${total} herramientas de pauta).`;
  } catch {
    estado = `${MARCA_LATIDO}: los hooks corren, pero la lista de solo lectura NO se pudo leer; todo lo de pauta queda bloqueado. Avisale a Guie.`;
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: estado } }));
}
