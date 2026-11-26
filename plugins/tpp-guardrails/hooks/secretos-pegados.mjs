#!/usr/bin/env node
// Hook UserPromptSubmit: si la persona pega algo con forma de credencial (token, llave, contraseña),
// el mensaje no se envía y se le explica por qué. Así la credencial no queda en la conversación.
//
// Solo patrones de alta precisión: formatos de llave conocidos, no "cualquier texto largo". Cada patrón
// tiene casos positivos y negativos en tests/secretos.test.mjs; antes de agregar uno, medí cuántos textos
// normales en español dispara (ver tests).
//
// Si el script falla, el mensaje pasa (no bloquea el trabajo): la regla 03 del kit sigue aplicando.

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// HARDENING (auditoría ofensiva 2026-11-26): se agregaron los formatos que pasaban (OAuth de Google, GitLab,
// Shopify, SendGrid, Notion, HubSpot, Telegram, usuario:clave en URL, "clave"/"es") y se ajustaron los que
// frenaban texto normal ("sk-campana-navidad.png", "contraseña: no-la-tengo", "pwd: C:\Users\…").
export const PATRONES = [
  ['llave de Anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['llave de OpenAI', /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|\bsk-[A-Za-z0-9]{40,}\b/],
  ['token de GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['token de GitLab', /\bglpat-[A-Za-z0-9_-]{20,}/],
  ['llave de Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['token OAuth de Google', /\bya29\.[A-Za-z0-9_-]{20,}|\b1\/\/0[A-Za-z0-9_-]{30,}/],
  ['secreto OAuth de Google', /\bGOCSPX-[A-Za-z0-9_-]{20,}/],
  ['llave de AWS', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['token de Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['token de Meta', /\bEAA[A-Za-z0-9]{60,}/],
  ['llave de Stripe', /\b[sr]k_live_[0-9a-zA-Z]{20,}/],
  ['token de Shopify', /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/],
  ['llave de SendGrid', /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/],
  ['token de Notion', /\b(?:ntn_[A-Za-z0-9]{40,}|secret_[A-Za-z0-9]{43})\b/],
  ['token de HubSpot', /\bpat-(?:na|eu)\d-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/],
  ['token de bot de Telegram', /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/],
  ['token JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['llave privada', /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/],
  ['usuario y clave dentro de una URL', /\bhttps?:\/\/[^\s:@/]+:[^\s@/]{4,}@[^\s]+/i],
  // "contraseña: X", "clave = X", "password es X", con o sin comillas. X tiene que parecer una clave de
  // verdad: 8+ caracteres sin espacios ni barras, con una letra y además un número o un símbolo fuerte.
  ['contraseña', /\b(?:password|passwd|pwd|contrase[nñ]a|clave)\s*(?::|=|\bes\b)\s*["'“]?(?=[^\s"'”\\/]*[A-Za-z])(?=[^\s"'”\\/]*[\d!@#$%^&*?¡¿])[^\s"'”\\/]{8,}/i],
];

/** Quita caracteres invisibles que se usan para partir un token sin que se note. */
export function normalizar(texto) {
  return texto.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '');
}

export function detectar(texto) {
  if (typeof texto !== 'string' || !texto) return null;
  const limpio = normalizar(texto);
  for (const [nombre, re] of PATRONES) if (re.test(limpio)) return nombre;
  return null;
}

function esPrincipal() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (esPrincipal()) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  const bloquear = (reason) => process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.stdin.on('end', () => {
    let entrada;
    try { entrada = JSON.parse(raw); }
    catch {
      // HARDENING (revisión Codex 2026-11-26): una entrada ilegible no se puede revisar, así que no pasa.
      // No se repite el mensaje del parser: puede incluir fragmentos del texto, y con ellos la credencial.
      bloquear('tpp-guardrails: no se pudo revisar tu mensaje, así que no se envió. Volvé a enviarlo; si se repite, mostrale este aviso a Guie.');
      process.exit(0);
    }
    const encontrado = detectar(entrada && entrada.prompt);
    if (encontrado) {
      bloquear(`tpp-guardrails: tu mensaje NO se envió porque parece tener una clave o contraseña (${encontrado}). ` +
        'Las claves nunca se pegan en el chat: se escriben en la pantalla de login del servicio. ' +
        'Copiá tu texto, borrá la clave y envialo de nuevo. Si esa clave ya circuló, cambiala en el servicio.');
    }
    process.exit(0);
  });
}
