#!/usr/bin/env node
// Diagnóstico del kit TPP en la máquina de la persona. Determinista, solo lectura, Mac / Windows / Linux.
//
// Nunca lee ni imprime valores secretos: de ~/.claude.json toma solo los NOMBRES de los conectores MCP y
// a qué plataforma de pauta apuntan; no imprime URLs completas, argumentos, variables de entorno ni headers.
//
// Uso:  node doctor.mjs            → resumen legible
//       node doctor.mjs --json     → resultado estructurado (lo usa /tpp:bienvenida)

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir, platform, release, arch } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { marcas, destinos } from './escribir-bloque.mjs';

export const NODE_MINIMO = 18;
export const MARKETPLACE = 'tpp-claude-kit';
// Repo oficial del kit. Lo escribe scripts/sincronizar.mjs desde kit.config.json: no editar a mano.
export const REPO_OFICIAL = 'tpp-kit/tpp-claude-kit';

/**
 * ¿El marketplace registrado con el nombre del kit viene del repo oficial?
 * HARDENING (revisión de exposición 2026-11-26): antes solo se miraba el nombre, y un fork llamado igual
 * pasado por WhatsApp quedaba aceptado y con actualización automática.
 * Devuelve { estado: 'oficial' | 'local' | 'ajeno' | 'ausente', detalle }.
 */
export function origenDelKit(home = homedir()) {
  let conocidos = null;
  try { conocidos = JSON.parse(readFileSync(join(home, '.claude', 'plugins', 'known_marketplaces.json'), 'utf8')); } catch { /* sin archivo */ }
  const src = conocidos?.[MARKETPLACE]?.source;
  if (!src) return { estado: 'ausente', detalle: 'el kit no está conectado' };
  const oficial = REPO_OFICIAL.toLowerCase();
  if (src.source === 'github' && String(src.repo || '').toLowerCase() === oficial) return { estado: 'oficial', detalle: `kit oficial (${REPO_OFICIAL})` };
  if (src.source === 'git' || src.source === 'url') {
    const url = String(src.url || '').toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '');
    if (url === `https://github.com/${oficial}`) return { estado: 'oficial', detalle: `kit oficial (${REPO_OFICIAL})` };
  }
  if (src.source === 'directory' || src.source === 'file') return { estado: 'local', detalle: 'el kit viene de una carpeta local (solo para quien lo mantiene)' };
  return { estado: 'ajeno', detalle: 'el kit conectado NO viene del repo oficial' };
}
export const PLUGINS_EQUIPO = ['tpp-estrategia', 'tpp-data', 'tpp-pauta', 'tpp-sac', 'tpp-diseno', 'tpp-automatizaciones'];

const HOME = homedir();
const ES_WINDOWS = platform() === 'win32';

function leerJson(ruta) {
  try { return JSON.parse(readFileSync(ruta, 'utf8')); } catch { return null; }
}

/**
 * Ruta del programa a ejecutar. En Windows se resuelve con where.exe y se descarta lo que esté en la carpeta
 * actual: cmd.exe busca ahí antes que en el PATH, y un "gh.cmd" plantado en un proyecto se ejecutaría.
 * HARDENING (auditoría ofensiva 2026-11-26).
 */
export function rutaComando(comando) {
  if (!ES_WINDOWS) return comando;
  const where = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe');
  const r = spawnSync(where, [comando], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  const aqui = resolve(process.cwd()).toLowerCase();
  const candidatos = (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    .filter((p) => !resolve(dirname(p)).toLowerCase().startsWith(aqui));
  return candidatos[0] || null;
}

function ejecutar(comando, args, opciones = {}) {
  const ruta = rutaComando(comando);
  if (!ruta) return { status: null, error: new Error('no encontrado') };
  const base = { encoding: 'utf8', timeout: 30000, windowsHide: true, ...opciones };
  // Los .cmd de Windows necesitan cmd.exe; se pasa la ruta absoluta entre comillas, nunca el nombre suelto.
  if (ES_WINDOWS) return spawnSync(`"${ruta}" ${args.join(' ')}`, { ...base, shell: true });
  return spawnSync(ruta, args, base);
}

export function versionDe(comando) {
  const r = ejecutar(comando, ['--version'], { timeout: 20000 });
  if (r.error || r.status !== 0) return null;
  const linea = `${r.stdout || ''}${r.stderr || ''}`.trim().split(/\r?\n/)[0] || '';
  const m = linea.match(/\d+\.\d+(\.\d+)?/);
  return m ? m[0] : linea.slice(0, 40) || 'instalado';
}

function rutasPoliticasOrg() {
  const rutas = [join(HOME, '.claude', 'remote-settings.json')];
  if (platform() === 'darwin') rutas.push('/Library/Application Support/ClaudeCode/managed-settings.json');
  else if (ES_WINDOWS) rutas.push('C:\\Program Files\\ClaudeCode\\managed-settings.json', 'C:\\ProgramData\\ClaudeCode\\managed-settings.json');
  else rutas.push('/etc/claude-code/managed-settings.json');
  return rutas;
}

/**
 * Plugins del kit con su estado EFECTIVO para la carpeta actual, según Claude Code (`claude plugin list --json`):
 * tiene en cuenta alcance de usuario/proyecto y la configuración que desactiva. Si Claude Code no responde,
 * cae a leer los archivos de instalación (ver pluginsInstalados), marcado como fuente "archivos".
 */
export function pluginsActivos(home = HOME) {
  const r = ejecutar('claude', ['plugin', 'list', '--json']);
  let lista = null;
  try { lista = r.status === 0 ? JSON.parse(r.stdout) : null; } catch { lista = null; }
  if (!Array.isArray(lista)) return { fuente: 'archivos', plugins: pluginsInstalados(home) };
  const out = {};
  for (const p of lista) {
    const [nombre, mkt] = String(p.id || '').split('@');
    if (mkt !== MARKETPLACE) continue;
    const activo = p.enabled === true || p.projectEnabled === true;
    if (out[nombre]?.habilitado && !activo) continue; // si hay una instalación activa, gana esa
    out[nombre] = { version: p.version || null, ruta: p.installPath || null, habilitado: activo, alcance: p.scope || null };
  }
  return { fuente: 'claude', plugins: out };
}

/** Lectura de respaldo desde los archivos: solo cuenta como activa una instalación de alcance usuario no desactivada. */
export function pluginsInstalados(home = HOME) {
  const datos = leerJson(join(home, '.claude', 'plugins', 'installed_plugins.json'));
  const settings = leerJson(join(home, '.claude', 'settings.json')) || {};
  const habilitados = settings.enabledPlugins || {};
  const out = {};
  for (const [id, entradas] of Object.entries(datos?.plugins || {})) {
    const [nombre, mkt] = id.split('@');
    if (mkt !== MARKETPLACE || !Array.isArray(entradas)) continue;
    const usuario = entradas.filter((e) => (e?.scope || 'user') === 'user');
    const e = usuario[usuario.length - 1] || entradas[entradas.length - 1];
    out[nombre] = {
      version: e?.version || null,
      ruta: e?.installPath || null,
      habilitado: usuario.length > 0 && habilitados[id] !== false,
      alcance: e?.scope || 'user',
    };
  }
  return out;
}

function tieneBloque(ruta, tipo) {
  const { inicio, fin } = marcas(tipo);
  try {
    const t = readFileSync(ruta, 'utf8');
    return t.includes(inicio) && t.includes(fin);
  } catch { return false; }
}

async function conectoresMcp(rutaCandados) {
  const cfg = leerJson(join(HOME, '.claude.json'));
  const nombres = new Set();
  for (const n of Object.keys(cfg?.mcpServers || {})) nombres.add(n);
  for (const p of Object.values(cfg?.projects || {})) for (const n of Object.keys(p?.mcpServers || {})) nombres.add(n);
  let plataformas = new Map();
  if (rutaCandados) {
    try {
      const mod = await import(pathToFileURL(join(rutaCandados, 'hooks', 'ads-readonly.mjs')).href);
      plataformas = mod.connectionPlatforms(process.cwd(), HOME);
    } catch { /* sin candados no clasificamos; se reporta aparte */ }
  }
  return [...nombres].sort().map((nombre) => ({ nombre, pauta: plataformas.get(nombre) || null }));
}

/**
 * Archivos de configuración que dicen disableAllHooks: true. Con eso Claude Code no corre ningún hook,
 * y los candados y las reglas quedan apagados aunque el plugin figure activo.
 * HARDENING (auditoría ofensiva 2026-11-26): antes el diagnóstico daba verde en ese caso.
 */
export function hooksApagadosEn(home = HOME, cwd = process.cwd()) {
  const rutas = [
    join(home, '.claude', 'settings.json'),
    join(home, '.claude', 'settings.local.json'),
    join(cwd, '.claude', 'settings.json'),
    join(cwd, '.claude', 'settings.local.json'),
    ...rutasPoliticasOrg().filter((r) => !r.endsWith('remote-settings.json')),
  ];
  return rutas.filter((r) => leerJson(r)?.disableAllHooks === true);
}

/** Los hooks que el plugin de candados tiene que declarar, comparados contra su hooks.json instalado. */
export const HOOKS_ESPERADOS = [
  ['SessionStart', null, 'latido.mjs'],
  ['PreToolUse', 'mcp__', 'ads-readonly.mjs'],
  ['PreToolUse', 'Bash', 'no-desactivar.mjs'],
  ['UserPromptSubmit', null, 'secretos-pegados.mjs'],
];
export function hooksFaltantes(rutaCandados) {
  const h = leerJson(join(rutaCandados, 'hooks', 'hooks.json'));
  if (!h) return ['hooks.json ilegible'];
  return HOOKS_ESPERADOS.filter(([evento, matcher, script]) => !(h.hooks?.[evento] || []).some((g) =>
    (matcher === null || String(g.matcher || '').includes(matcher)) && (g.hooks || []).some((x) => String(x.command || '').includes(script))))
    .map(([evento, , script]) => `${evento} → ${script}`);
}

function verificarCandados(rutaCandados) {
  if (!rutaCandados) return { ok: false, detalle: 'tpp-guardrails no está instalado' };
  const script = join(rutaCandados, 'hooks', 'verificar.mjs');
  if (!existsSync(script)) return { ok: false, detalle: 'falta verificar.mjs en tpp-guardrails' };
  const r = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, detalle: `la verificación no respondió (${(r.stderr || '').trim().slice(0, 200)})` }; }
}

export async function diagnosticar() {
  const checks = [];
  const add = (id, estado, detalle, arreglo = null) => checks.push({ id, estado, detalle, arreglo });

  const REINSTALAR = 'Volvé a correr el instalador del kit; él lo instala.';
  const nodeMayor = Number(process.versions.node.split('.')[0]);
  add('node', nodeMayor >= NODE_MINIMO ? 'ok' : 'falta', `Node ${process.versions.node}`,
    nodeMayor >= NODE_MINIMO ? null : `Tu versión de Node es vieja. ${REINSTALAR}`);

  const claude = versionDe('claude');
  add('claude', claude ? 'ok' : 'falta', claude ? `Claude Code ${claude}` : 'no encuentro Claude Code', claude ? null : REINSTALAR);
  const git = versionDe('git');
  add('git', git ? 'ok' : 'falta', git ? `Git ${git}` : 'falta Git', git ? null : REINSTALAR);
  const gh = versionDe('gh');
  add('gh', gh ? 'ok' : 'opcional', gh ? `GitHub CLI ${gh}` : 'GitHub CLI no instalado (solo hace falta si el kit es privado)');

  const codex = versionDe('codex');
  const gemini = versionDe('gemini');
  add('codex', codex ? 'ok' : 'opcional', codex ? `Codex ${codex}` : 'Codex no instalado (opcional)');
  add('gemini', gemini ? 'ok' : 'opcional', gemini ? `Gemini ${gemini}` : 'Gemini no instalado (opcional)');

  const origen = origenDelKit(HOME);
  add('origen-del-kit', origen.estado === 'oficial' ? 'ok' : origen.estado === 'local' ? 'aviso' : 'falta', origen.detalle,
    origen.estado === 'ajeno' ? 'Puede ser una copia alterada. No lo uses y mandale este diagnóstico a Guie.'
      : origen.estado === 'ausente' ? REINSTALAR : null);

  const { fuente, plugins } = pluginsActivos();
  const base = plugins.tpp;
  add('plugin-tpp', base?.habilitado ? 'ok' : 'falta', base ? `kit base ${base.habilitado ? 'activo' : 'instalado pero apagado'}` : 'kit base no instalado',
    base?.habilitado ? null : (base ? 'Activalo con: claude plugin enable tpp@tpp-claude-kit' : REINSTALAR));
  const candados = plugins['tpp-guardrails'];
  add('plugin-guardrails', candados?.habilitado ? 'ok' : 'falta',
    candados ? `candados ${candados.habilitado ? 'activos' : 'instalados pero apagados'}` : 'candados no instalados',
    candados?.habilitado ? null : (candados ? 'Activalos con: claude plugin enable tpp-guardrails@tpp-claude-kit' : REINSTALAR));
  if (fuente === 'archivos') add('fuente-plugins', 'aviso', 'no pude preguntarle a Claude Code qué plugins están activos; lo leí de los archivos de instalación');
  const { estadoActualizacion } = await import('./activar-actualizacion.mjs');
  const actualizacion = estadoActualizacion(HOME);
  add('actualizacion', actualizacion.activa ? 'ok' : 'aviso',
    actualizacion.activa ? 'el kit se actualiza solo' : 'el kit no se actualiza solo',
    actualizacion.activa ? null : 'Lo activa /tpp:bienvenida en un paso.');
  const equipos = PLUGINS_EQUIPO.filter((p) => plugins[p]?.habilitado);
  add('plugin-equipo', equipos.length ? 'ok' : 'aviso', equipos.length ? `equipo: ${equipos.join(', ')}` : 'todavía no tenés el plugin de tu equipo',
    equipos.length ? null : 'Lo instala /tpp:bienvenida según tu equipo.');

  // Esto prueba que los scripts de los candados bloquean lo que deben. Que Claude Code los esté EJECUTANDO
  // en la sesión lo prueba la marca del latido en el contexto, que revisan /tpp:diagnostico y /tpp:bienvenida.
  const verif = verificarCandados(candados?.habilitado ? candados.ruta : null);
  add('candados-funcionan', verif.ok ? 'ok' : 'falta', verif.detalle || (verif.ok ? 'los candados bloquean lo que deben' : 'los candados fallaron'),
    verif.ok ? null : 'No uses los conectores de pauta. Copiá todo este diagnóstico y mandáselo a Guie.');
  if (candados?.ruta) {
    const faltan = hooksFaltantes(candados.ruta);
    add('candados-declarados', faltan.length ? 'falta' : 'ok',
      faltan.length ? `a los candados instalados les faltan hooks: ${faltan.join(', ')}` : 'los candados declaran sus 4 hooks',
      faltan.length ? 'No uses los conectores de pauta. Copiá todo este diagnóstico y mandáselo a Guie.' : null);
  }
  const apagados = hooksApagadosEn(HOME, process.cwd());
  add('hooks-encendidos', apagados.length ? 'falta' : 'ok',
    apagados.length ? `una configuración apaga todos los hooks (disableAllHooks): ${apagados.join(', ')}` : 'ninguna configuración apaga los hooks',
    apagados.length ? 'Con esto los candados no corren. No uses los conectores de pauta y mandale este diagnóstico a Guie.' : null);

  const conectores = await conectoresMcp(candados?.habilitado ? candados.ruta : null);
  const dePauta = conectores.filter((c) => c.pauta);
  add('conectores', 'ok', conectores.length ? `${conectores.length} conectores: ${conectores.map((c) => c.nombre).join(', ')}` : 'sin conectores instalados en esta computadora');
  if (dePauta.length) {
    add('conectores-pauta', candados?.habilitado && verif.ok ? 'aviso' : 'falta',
      `conectores de pauta: ${dePauta.map((c) => `${c.nombre} (${c.pauta})`).join(', ')}`,
      'Quedan en solo lectura por los candados. Pedile a tu líder que confirme que tu usuario en Meta, Google y TikTok también es de solo lectura.');
  }

  const politicas = rutasPoliticasOrg().filter((r) => existsSync(r));
  add('politicas-org', politicas.length ? 'ok' : 'opcional', politicas.length ? 'políticas de organización detectadas' : 'sin políticas de organización (no es obligatorio)');

  const archivos = destinos(HOME);
  const perfil = tieneBloque(archivos.claude, 'claude');
  add('perfil-claude', perfil ? 'ok' : 'falta', perfil ? 'tu perfil personal está listo' : 'falta tu perfil personal',
    perfil ? null : 'Lo genera /tpp:bienvenida.');
  for (const [id, version, nombre] of [['codex', codex, 'Codex'], ['gemini', gemini, 'Gemini']]) {
    if (!version) continue;
    const tiene = tieneBloque(archivos[id], id);
    add(`perfil-${id}`, tiene ? 'ok' : 'aviso', tiene ? `${nombre} tiene las reglas del kit` : `${nombre} no tiene las reglas del kit`,
      tiene ? null : 'Lo agrega /tpp:bienvenida.');
  }

  return {
    sistema: { so: platform(), version: release(), arquitectura: arch() },
    listo: !checks.some((c) => c.estado === 'falta'),
    checks,
    plugins,
    fuente_plugins: fuente,
  };
}

const ICONO = { ok: '[ok]     ', falta: '[FALTA]  ', aviso: '[aviso]  ', opcional: '[opcional]' };

async function main() {
  const r = await diagnosticar();
  if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(r, null, 2)); return; }
  console.log(`Kit TPP · diagnóstico (${r.sistema.so} ${r.sistema.arquitectura})\n`);
  for (const c of r.checks) {
    console.log(`${ICONO[c.estado] || c.estado} ${c.detalle}`);
    if (c.arreglo && c.estado !== 'ok') console.log(`           → ${c.arreglo}`);
  }
  console.log(`\n${r.listo ? 'Todo lo obligatorio está en orden.' : 'Hay pasos obligatorios pendientes (marcados FALTA).'}`);
}

function esPrincipal() {
  if (typeof import.meta.main === 'boolean') return import.meta.main;
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (esPrincipal()) main().catch((e) => { console.error(`doctor: ${e && e.message}`); process.exit(1); });
