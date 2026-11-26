#!/usr/bin/env node
// Validación estructural del kit. Corre en el CI y en `npm test`. Sale con 1 si encuentra un problema.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const problemas = [];
const mal = (m) => problemas.push(m);
const json = (ruta) => { try { return JSON.parse(readFileSync(ruta, 'utf8')); } catch (e) { mal(`JSON inválido: ${relative(RAIZ, ruta)} (${e.message})`); return null; } };

const HERRAMIENTAS_VALIDAS = new Set(['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'WebSearch', 'WebFetch', 'NotebookEdit', 'TodoWrite']);
const MODELOS_VALIDOS = new Set(['sonnet', 'haiku', 'opus', 'inherit']);

export function frontmatter(texto) {
  const t = texto.replace(/\r\n/g, '\n');
  if (!t.startsWith('---\n')) return null;
  const fin = t.indexOf('\n---', 4);
  if (fin === -1) return null;
  const meta = {};
  for (const linea of t.slice(4, fin).split('\n')) {
    const m = linea.match(/^([a-z_-]+):\s*(.*)$/i);
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

const config = json(join(RAIZ, 'kit.config.json'));
const marketplace = json(join(RAIZ, '.claude-plugin', 'marketplace.json'));
if (!config || !marketplace) process.exit(1);

// 1. Marketplace ↔ carpetas ↔ kit.config
if (marketplace.name !== config.marketplace) mal(`marketplace.json se llama "${marketplace.name}" y kit.config dice "${config.marketplace}"`);
const declarados = new Set();
for (const p of marketplace.plugins || []) {
  declarados.add(p.name);
  const dir = join(RAIZ, p.source);
  const manifiesto = join(dir, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifiesto)) { mal(`${p.name}: falta ${relative(RAIZ, manifiesto)}`); continue; }
  const m = json(manifiesto);
  if (m && m.name !== p.name) mal(`${p.name}: plugin.json dice name="${m.name}"`);
  if (m && 'version' in m) mal(`${p.name}: plugin.json no debe fijar version (la versión es el commit; con versión fija las personas no reciben los cambios)`);
  if (!p.description) mal(`${p.name}: falta description en marketplace.json`);
}
for (const nombre of [config.plugin_base, config.plugin_candados, ...Object.values(config.plugins_equipo)]) {
  if (!declarados.has(nombre)) mal(`kit.config menciona ${nombre} pero no está en marketplace.json`);
}
for (const carpeta of readdirSync(join(RAIZ, 'plugins'))) {
  if (!declarados.has(carpeta)) mal(`plugins/${carpeta} no está declarado en marketplace.json`);
}

// 2. Contenido de cada plugin
const idsReglas = new Map();
const nombresAgentes = new Map();
for (const p of marketplace.plugins || []) {
  const dir = join(RAIZ, p.source);
  const sub = (s) => (existsSync(join(dir, s)) ? readdirSync(join(dir, s)).filter((f) => f.endsWith('.md')) : []);

  for (const f of sub('agents')) {
    const meta = frontmatter(readFileSync(join(dir, 'agents', f), 'utf8'));
    const donde = `${p.name}/agents/${f}`;
    if (!meta) { mal(`${donde}: sin frontmatter`); continue; }
    if (meta.name !== f.replace(/\.md$/, '')) mal(`${donde}: name "${meta.name}" no coincide con el archivo`);
    if (!meta.description || meta.description.length < 40) mal(`${donde}: description vacía o muy corta`);
    if (meta.model && !MODELOS_VALIDOS.has(meta.model)) mal(`${donde}: modelo "${meta.model}" no válido`);
    if (meta.tools) for (const t of meta.tools.split(',').map((x) => x.trim())) if (!HERRAMIENTAS_VALIDAS.has(t)) mal(`${donde}: herramienta "${t}" desconocida`);
    if (nombresAgentes.has(meta.name)) mal(`${donde}: el agente ${meta.name} ya existe en ${nombresAgentes.get(meta.name)}`);
    nombresAgentes.set(meta.name, p.name);
  }
  const propios = sub('agents').length;
  const limite = p.name === config.plugin_base ? 3 : 3;
  if (propios > limite) mal(`${p.name}: tiene ${propios} agentes; el máximo es ${limite}`);

  for (const f of sub('commands')) {
    const meta = frontmatter(readFileSync(join(dir, 'commands', f), 'utf8'));
    if (!meta?.description) mal(`${p.name}/commands/${f}: falta description`);
  }

  for (const f of sub('reglas')) {
    const meta = frontmatter(readFileSync(join(dir, 'reglas', f), 'utf8'));
    const donde = `${p.name}/reglas/${f}`;
    if (!meta) { mal(`${donde}: sin frontmatter`); continue; }
    for (const k of ['id', 'titulo', 'version', 'dueno', 'aplica']) if (!meta[k]) mal(`${donde}: falta "${k}"`);
    if (meta.version && !/^\d+$/.test(meta.version)) mal(`${donde}: version debe ser un número entero`);
    if (idsReglas.has(meta.id)) mal(`${donde}: id "${meta.id}" repetido (ya está en ${idsReglas.get(meta.id)})`);
    idsReglas.set(meta.id, donde);
  }
  if (sub('reglas').length && !existsSync(join(dir, 'hooks', 'cargar-reglas.mjs'))) mal(`${p.name}: tiene reglas pero no el cargador (npm run sincronizar)`);

  const hooksJson = join(dir, 'hooks', 'hooks.json');
  if (existsSync(hooksJson)) {
    const h = json(hooksJson);
    for (const grupos of Object.values(h?.hooks || {})) for (const g of grupos) for (const hook of g.hooks || []) {
      const m = (hook.command || '').match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+)/);
      if (!m) { mal(`${p.name}/hooks/hooks.json: comando sin \${CLAUDE_PLUGIN_ROOT}: ${hook.command}`); continue; }
      if (!existsSync(join(dir, m[1]))) mal(`${p.name}/hooks/hooks.json: no existe ${m[1]}`);
    }
  }
}

// 3. Constantes que repiten kit.config
const doctor = await import(pathToFileURL(join(RAIZ, 'plugins', 'tpp', 'scripts', 'doctor.mjs')).href);
if (doctor.NODE_MINIMO !== config.node_minimo) mal(`doctor.mjs NODE_MINIMO=${doctor.NODE_MINIMO} y kit.config node_minimo=${config.node_minimo}`);
if (doctor.MARKETPLACE !== config.marketplace) mal(`doctor.mjs MARKETPLACE="${doctor.MARKETPLACE}" y kit.config "${config.marketplace}"`);
if (JSON.stringify([...doctor.PLUGINS_EQUIPO].sort()) !== JSON.stringify(Object.values(config.plugins_equipo).sort())) mal('doctor.mjs PLUGINS_EQUIPO no coincide con kit.config plugins_equipo');
const pkg = json(join(RAIZ, 'package.json'));
if (pkg?.engines?.node !== `>=${config.node_minimo}`) mal(`package.json engines.node debe ser >=${config.node_minimo}`);

// 4. La lista de solo lectura no tiene herramientas con nombre de escritura (misma regla que verificar.mjs).
const { herramientasSospechosas } = await import(pathToFileURL(join(RAIZ, 'plugins', 'tpp-guardrails', 'hooks', 'ads-readonly.mjs')).href);
const lista = json(join(RAIZ, 'plugins', 'tpp-guardrails', 'hooks', 'ads-readonly-allowlist.json'));
for (const s of herramientasSospechosas(lista)) mal(`allowlist: ${s} parece de escritura`);

// 5. Ningún archivo del repo trae algo con forma de credencial
const { detectar } = await import(pathToFileURL(join(RAIZ, 'plugins', 'tpp-guardrails', 'hooks', 'secretos-pegados.mjs')).href);
function recorrer(dir) {
  for (const f of readdirSync(dir)) {
    if (['.git', 'node_modules'].includes(f)) continue;
    const ruta = join(dir, f);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else if (/\.(md|mjs|js|json|sh|ps1|yml|yaml)$/.test(f)) {
      const hallado = detectar(readFileSync(ruta, 'utf8'));
      if (hallado) mal(`${relative(RAIZ, ruta)}: contiene algo con forma de ${hallado}`);
    }
  }
}
recorrer(RAIZ);

if (problemas.length) {
  console.error(`validar: ${problemas.length} problema(s)`);
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`validar: ${declarados.size} plugins, ${nombresAgentes.size} agentes, ${idsReglas.size} reglas, todo en orden`);
