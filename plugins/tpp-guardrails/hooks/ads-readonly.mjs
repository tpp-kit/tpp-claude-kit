#!/usr/bin/env node
// Hook PreToolUse: deja en SOLO LECTURA los conectores oficiales de pauta (Meta, TikTok, Google Ads).
//
// Lista permitida cerrada, no lista negra: cualquier herramienta de un conector de pauta que no esté en
// ads-readonly-allowlist.json se bloquea, incluidas las que la plataforma agregue después. Los conectores
// oficiales piden permisos de escritura al hacer login (el de TikTok incluye mover fondos), así que la
// garantía tiene que estar de nuestro lado. En el kit TPP no hay camino de escritura.
//
// Esto es la ÚLTIMA capa, no la única: el rol de solo lectura en cada plataforma y las políticas de la
// organización van primero. Si a la máquina le falta Node, este hook no corre: lo detecta /tpp:diagnostico.
//
// Contrato de hooks de Claude Code: stdin = JSON con tool_name. Bloquear = JSON en stdout con
// permissionDecision "deny". Permitir = salir con 0 sin imprimir (sigue el flujo normal de permisos).
//
// Basado en un hook de solo lectura anterior del mismo autor, conservando sus
// endurecimientos de auditoría y quitando el contrato de escrituras autorizadas.

import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
// HARDENING: la lista vive SOLO junto al hook. Una variable de entorno que la reemplace sería una válvula
// de escape: con una lista propia, ads_create_campaign pasaría de bloqueada a permitida.
const ALLOWLIST_PATH = join(HERE, 'ads-readonly-allowlist.json');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// Plataformas protegidas sin importar cómo se llame el conector (meta-ads, claude_ai_Meta_Ads, meta_ads…)
// ni lo que diga la lista: una clave ausente significa "nada permitido", nunca "sin protección".
const PLATFORMS = [
  ['meta-ads', /(meta|facebook|\bfb)[-_ ]?ads|ads[-_ ]?(meta|facebook)/i],
  ['tiktok-ads', /tik[-_ ]?tok/i],
  ['google-ads', /google[-_ ]?ads|ads[-_ ]?google|adwords/i],
];
// HARDENING: la plataforma se ata a la CONEXIÓN real, no solo al nombre. Un conector llamado "tt" u
// "odoo" que apunta a business-api.tiktok.com o a mcp.facebook.com se protege igual.
const CONNECTION_PATTERNS = [
  ['meta-ads', /mcp\.facebook\.com|graph\.facebook\.com/i],
  ['tiktok-ads', /business-api\.tiktok\.com|tiktok/i],
  ['google-ads', /google[-_]?ads(?!ense)|googleads\.googleapis\.com|adwords/i],
];

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

// HARDENING (auditoría ofensiva kit TPP 2026-11-26): el texto de la conexión se normaliza antes de buscar la
// plataforma. Pasaban "mcp\u3002facebook\u3002com" (puntos de ancho completo), "tik%74ok.com" (escape de URL) y
// "mcp.face''book.com" (comillas que el shell borra). Se miran también env y headers: la URL puede ir ahí.
function partesDeConexion(def) {
  const d = def && typeof def === 'object' ? def : {};
  const valores = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.values(o) : []);
  return [d.url, d.command, ...(Array.isArray(d.args) ? d.args : []), ...valores(d.env), ...valores(d.headers)]
    .filter((x) => typeof x === 'string');
}
export function textoConexion(def) {
  const variantes = [];
  for (const p of partesDeConexion(def)) {
    const plano = p.normalize('NFKC').replace(/[\u3002\uFF0E\uFF61]/g, '.').replace(/['"`\\\u00AD\u200B-\u200D\u2060\uFEFF]/g, '');
    variantes.push(plano);
    try { variantes.push(decodeURIComponent(plano)); } catch { /* escape inválido: queda la forma plana */ }
    for (const m of plano.match(/https?:\/\/[^\s]+/gi) || []) {
      try { variantes.push(new URL(m).hostname); } catch { /* no es URL */ }
    }
  }
  return variantes.join(' ');
}
// Una conexión con expansión de variables o de comandos ($VAR, ${X:-y}, $(…), `…`) es OPACA: el destino real
// recién se sabe al arrancar el servidor. Nunca puede declararse "no de pauta".
// HARDENING (auditoría ofensiva 2026-11-26): "https://mcp.${X:-face}book.com/ads" pasaba como conexión ajena.
const OPACA = /\$|`/;
const esOpaca = (def) => partesDeConexion(def).some((p) => OPACA.test(p));

// Claude Code arma el nombre de la herramienta reemplazando lo que no sea [A-Za-z0-9_-] por "_".
// HARDENING (auditoría ofensiva 2026-11-26): un conector "tt." llegaba como "tt_" y el mapa no lo encontraba.
export const normalizarNombre = (n) => String(n).replace(/[^A-Za-z0-9_-]/g, '_');
const ancestroOIgual = (ruta, cwd) => { const a = resolve(ruta), c = resolve(cwd); return c === a || c.startsWith(a.endsWith(sep) ? a : a + sep); };

/**
 * Map nombre-de-servidor → plataforma protegida, o null si la conexión es conocida, confiable y NO es de pauta.
 * - Una coincidencia con una plataforma en CUALQUIER definición protege ese nombre (solo endurece).
 * - "No de pauta" (null) solo sale de definiciones confiables que aplican a la carpeta actual: la de usuario o la
 *   del proyecto actual en ~/.claude.json, ninguna opaca.
 * - Si un .mcp.json de la carpeta actual o de sus carpetas padre define el nombre, esa definición tiene precedencia
 *   y no es confiable: la conexión queda DESCONOCIDA (undefined). HARDENING (auditoría ofensiva 2026-11-26): un
 *   repo redefinía "odoo" con un destino escondido y heredaba la exención del "odoo" del usuario.
 */
export function connectionPlatforms(cwd, home = homedir()) {
  const defs = new Map();
  const add = (servers, alcance) => {
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return;
    for (const [name, def] of Object.entries(servers)) {
      const n = normalizarNombre(name);
      if (!defs.has(n)) defs.set(n, []);
      defs.get(n).push({ alcance, texto: textoConexion(def), opaca: esOpaca(def) });
    }
  };
  const hayCwd = typeof cwd === 'string' && cwd.length > 0;
  const user = readJson(join(home, '.claude.json'));
  if (user) {
    add(user.mcpServers, 'usuario');
    for (const [ruta, project] of Object.entries(user.projects || {})) {
      add(project && project.mcpServers, hayCwd && ancestroOIgual(ruta, cwd) ? 'local' : 'otro');
    }
  }
  if (hayCwd) {
    for (let dir = resolve(cwd), prev = null; dir !== prev; prev = dir, dir = dirname(dir)) {
      add(readJson(join(dir, '.mcp.json'))?.mcpServers, 'proyecto');
    }
  }
  const map = new Map();
  for (const [n, lista] of defs) {
    const hit = CONNECTION_PATTERNS.find(([, re]) => lista.some((d) => re.test(d.texto)));
    if (hit) { map.set(n, hit[0]); continue; }
    if (lista.some((d) => d.alcance === 'proyecto')) continue;               // desconocida: la manda el repo
    const aplicables = lista.filter((d) => d.alcance === 'usuario' || d.alcance === 'local');
    if (aplicables.length && !aplicables.some((d) => d.opaca)) map.set(n, null);
  }
  return map;
}

// Familias de herramientas de TikTok y escritura de Google. HARDENING (Codex + ofensiva, kit TPP 2026-11-26):
//  - conexión DESCONOCIDA (conector de claude.ai, plugin, o la manda un repo): toda la familia de TikTok y "mutate".
//  - conexión CONOCIDA y no de pauta: solo familias de TikTok con verbo de escritura. Así un proxy local "tt" que
//    corre `node proxy.mjs` no esconde campaign_create ni bc_transfer, y un "file_read" o un "mutate" de otro
//    servicio legítimo no se bloquean por error.
//  - nombre AMBIGUO (varios "__"): se prueban todos los cortes posibles.
const GOOGLE_FAMILIES = /mutate/i;
const TIKTOK_FAMILIES = /^(ad|adgroup|advertiser|app|audience_insight|auth|bc|blockedword|campaign|catalog|changelog|comment|creative|crm|ctm|custom_conversion|diagnostic|discovery|dmp|file|gmv_max|identity|lead|minis|offline|optimizer_rule|page|pangle|payment_portfolio|pixel|playable|report|rf|search_ad|search_region|showcase|smart_plus|spark_ad|split_test|store|subscription|targeting|tcm|term|tiktok|tool|tt_video|tto|video_fix)_/;
const VERBO_ESCRITURA = /(^|_)(create|update|delete|remove|add|set|transfer|upload|bind|unbind|apply|pause|enable|disable|edit|copy|submit|cancel|recharge|assign|unassign|approve|publish|send|post|save|modify|reset|revoke|grant|link|unlink|confirm|activate|deactivate|archive|appeal|migrate|subscribe|unsubscribe|operate|invite|duplicate|boost|connect|disconnect|authorize|mutate|promote|fix|run)(_|$)/i;

const VERBO_CONSULTA = /(^|_)(get|list|search|read|check)(_|$)/i;
// Lo usan tests/validar.mjs (CI) y verificar.mjs (cada máquina): una lista adulterada se detecta en ambos.
export function herramientasSospechosas(lista) {
  const out = [];
  for (const [plataforma, tools] of Object.entries(lista?.servers || {})) {
    if (!Array.isArray(tools)) { out.push(`${plataforma}: la lista no es un arreglo`); continue; }
    for (const t of tools) if (typeof t !== 'string' || (VERBO_ESCRITURA.test(t) && !VERBO_CONSULTA.test(t))) out.push(`${plataforma}: ${t}`);
  }
  if (lista && 'escrituras' in lista) out.push('la lista declara escrituras; en el kit TPP no existen');
  return out;
}

export function platformOf(server) {
  if (PLATFORMS.some(([name]) => name === server)) return server;
  const hit = PLATFORMS.find(([, re]) => re.test(server));
  return hit ? hit[0] : null;
}

// HARDENING (C07): inspect every delimiter, including overlapping pairs in triple underscores.
export function classifyTool(toolName, config = {}, connections = new Map()) {
  if (typeof toolName !== 'string' || !toolName.startsWith('mcp__')) return null;
  const body = toolName.slice(5), cuts = [];
  for (let i = 0; i < body.length - 1; i++) if (body.slice(i, i + 2) === '__') cuts.push(i);
  const firmas = config?.firmas || {};
  const signature = tool => /^ads_/i.test(tool) || /^offer_report$/i.test(tool)
    || Object.values(firmas).some(names => Array.isArray(names) && names.some(name => typeof name === 'string' && name.toLowerCase() === tool.toLowerCase()));
  const signed = cuts.find(i => signature(body.slice(i + 2)));
  const cut = signed ?? cuts.at(-1);
  const server = cut === undefined ? body : body.slice(0, cut);
  const tool = cut === undefined ? '' : body.slice(cut + 2);
  const ambiguous = cuts.length !== 1 || !server || !tool;
  // undefined = conexión desconocida · null = conocida y no es de pauta · texto = plataforma protegida.
  const connection = connections.get(server);
  // Un servidor "ajeno" (odoo) solo queda eximido si su conexión real se conoce y no es de pauta:
  // el alias "odoo" apuntando a mcp.facebook.com no exime nada.
  const ajeno = !ambiguous && Array.isArray(config?.servidores_ajenos) && config.servidores_ajenos.includes(server) && connection === null;
  const metaTool = signed !== undefined;
  const candidatas = ambiguous ? cuts.map(i => body.slice(i + 2)).filter(Boolean) : [tool];
  const desconocida = ambiguous || connection === undefined;
  const tiktokTool = candidatas.some(t => TIKTOK_FAMILIES.test(t) && (desconocida || VERBO_ESCRITURA.test(t)));
  const googleTool = desconocida && candidatas.some(t => GOOGLE_FAMILIES.test(t));
  const platform = platformOf(toolName) || connection || (!ajeno && metaTool ? 'meta-ads' : null)
    || (!ajeno && tiktokTool ? 'tiktok-ads' : null) || (!ajeno && googleTool ? 'google-ads' : null);
  return { server, tool, platform, ambiguous };
}

// HARDENING: JSON.parse valida la sintaxis; después se revisa que ningún objeto repita una clave
// (incluidas claves equivalentes escapadas). Un JSON con "tool_name" dos veces se bloquea.
class DuplicateKey extends Error {}
export function parseUnique(raw) {
  const parsed = JSON.parse(raw);
  const tokens = raw.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '{') stack.push(new Set());
    else if (t === '[') stack.push(null);
    else if (t === '}' || t === ']') stack.pop();
    else if (t.startsWith('"') && tokens[i + 1] === ':') {
      const key = JSON.parse(t), keys = stack[stack.length - 1];
      if (keys.has(key)) throw new DuplicateKey();
      keys.add(key);
    }
  }
  return parsed;
}

/** Decide sin efectos: devuelve null si se permite, o el motivo del bloqueo. */
export function decidir(raw, { allowlistPath = ALLOWLIST_PATH, home = homedir() } = {}) {
  let input;
  try { input = parseUnique(raw); }
  catch (e) {
    if (e instanceof DuplicateKey) return 'clave duplicada en el JSON de entrada; se bloquea por seguridad.';
    return 'entrada ilegible; se bloquea por seguridad.';
  }
  const toolName = input && input.tool_name;
  if (typeof toolName !== 'string') return 'falta tool_name; se bloquea por seguridad.';
  if (!toolName.startsWith('mcp__')) return null;
  const conexiones = connectionPlatforms(input.cwd, home);
  const config = readJson(allowlistPath);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    // HARDENING (revisión Codex 2026-11-26): sin lista también se miran las conexiones reales. Antes un alias
    // "reportes" conectado a Google Ads pasaba cuando faltaba la lista, porque solo se miraba el nombre.
    return classifyTool(toolName, {}, conexiones)?.platform ? 'no se pudo leer la lista permitida; se bloquea por seguridad.' : null;
  }
  const { server, tool, platform, ambiguous } = classifyTool(toolName, config, conexiones);
  if (!platform) return null;
  if (ambiguous) return 'nombre de conector de pauta ambiguo; se bloquea por seguridad.';
  const allowed = config.servers && typeof config.servers === 'object' ? config.servers[platform] : null;
  if (Array.isArray(allowed) && allowed.includes(tool)) return null;
  const nombre = { 'meta-ads': 'Meta', 'tiktok-ads': 'TikTok', 'google-ads': 'Google Ads' }[platform] || platform;
  return `Claude intentó usar una función de ${nombre} que puede cambiar algo, y el kit la frenó. ` +
    'En pauta Claude solo mira y propone; los cambios los hacés vos en la plataforma. ' +
    `Si solo querías ver datos, avisale a Guie con este texto: ${server} / ${tool}.`;
}

function esPrincipal() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (esPrincipal()) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const motivo = decidir(raw);
      if (motivo) deny(`tpp-guardrails: ${motivo}`);
      process.exit(0);
    } catch (e) {
      // Cualquier falla inesperada bloquea: el código 2 es un error bloqueante para los hooks de Claude Code.
      try { deny(`tpp-guardrails: error inesperado (${e && e.message}); se bloquea por seguridad. Mostrale este mensaje a Guie; mientras tanto podés seguir sin ese conector.`); }
      catch { process.exit(2); }
    }
  });
}
