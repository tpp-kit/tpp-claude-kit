import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reemplazarBloque, marcas } from '../plugins/tpp/scripts/escribir-bloque.mjs';
import { conActualizacion, estadoActualizacion } from '../plugins/tpp/scripts/activar-actualizacion.mjs';
import { pluginsInstalados, diagnosticar, hooksApagadosEn, hooksFaltantes, origenDelKit, REPO_OFICIAL } from '../plugins/tpp/scripts/doctor.mjs';
import { armarContexto } from '../shared/cargar-reglas.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporal = () => mkdtempSync(join(tmpdir(), 'kit-tpp-test-'));

const M = marcas('claude');

test('el bloque del kit se agrega sin tocar lo que ya tenía la persona', () => {
  const { texto, accion } = reemplazarBloque('# Mis notas\n\nalgo mío\n', 'perfil nuevo', 'claude');
  assert.equal(accion, 'agregado');
  assert.ok(texto.startsWith('# Mis notas\n\nalgo mío'));
  assert.ok(texto.includes(`${M.inicio}\nperfil nuevo\n${M.fin}`));
});

test('el bloque del kit se reemplaza y lo de afuera queda igual', () => {
  const antes = `arriba\n${M.inicio}\nviejo\n${M.fin}\nabajo\n`;
  const { texto, accion } = reemplazarBloque(antes, 'nuevo', 'claude');
  assert.equal(accion, 'reemplazado');
  assert.equal(texto, `arriba\n${M.inicio}\nnuevo\n${M.fin}\nabajo\n`);
});

test('marcas rotas o contenido con marcas no se escriben', () => {
  assert.throws(() => reemplazarBloque(`${M.inicio}\nsin fin`, 'x', 'claude'));
  assert.throws(() => reemplazarBloque(`${M.fin}\n${M.inicio}`, 'x', 'claude'));
  assert.throws(() => reemplazarBloque(`${M.inicio}\na\n${M.fin}\n${M.inicio}\nb\n${M.fin}`, 'x', 'claude'));
  assert.throws(() => reemplazarBloque('', `inyecto ${marcas('codex').fin} y sigo`, 'claude'));
});

test('el perfil y las reglas conviven aunque sean el mismo archivo', () => {
  const conPerfil = reemplazarBloque('', 'mi perfil', 'claude').texto;
  const conAmbos = reemplazarBloque(conPerfil, 'reglas del kit', 'codex').texto;
  assert.ok(conAmbos.includes('mi perfil') && conAmbos.includes('reglas del kit'));
  const otraVez = reemplazarBloque(conAmbos, 'reglas nuevas', 'gemini').texto;
  assert.ok(otraVez.includes('mi perfil') && otraVez.includes('reglas nuevas') && !otraVez.includes('reglas del kit'));
});

function correrEscribir(home, args) {
  const script = join(RAIZ, 'plugins', 'tpp', 'scripts', 'escribir-bloque.mjs');
  return spawnSync(process.execPath, [script, ...args], { env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8', timeout: 60000 });
}

test('escribir-bloque solo acepta sus destinos, orígenes temporales y contenido sin credenciales', () => {
  const home = temporal();
  try {
    const desde = join(home, 'perfil.md');
    writeFileSync(desde, 'mi perfil');
    assert.notEqual(correrEscribir(home, ['--destino', '../../etc/passwd', '--desde', desde]).status, 0, 'destino inventado');
    assert.notEqual(correrEscribir(home, ['--destino', '__proto__', '--desde', desde]).status, 0, 'destino __proto__');
    const fueraDeTemporal = correrEscribir(home, ['--destino', 'claude', '--desde', join(RAIZ, 'package.json')]);
    assert.notEqual(fueraDeTemporal.status, 0, 'origen fuera de la carpeta temporal');
    assert.match(fueraDeTemporal.stderr, /carpeta temporal/);
    const conCredencial = join(home, 'malo.md');
    writeFileSync(conCredencial, ['token ', 'gh', 'p_', 'X'.repeat(36)].join(''));
    const r1 = correrEscribir(home, ['--destino', 'gemini', '--desde', conCredencial]);
    assert.notEqual(r1.status, 0);
    assert.match(r1.stderr, /credencial/);
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude', 'CLAUDE.md'), 'lo mío');
    const bien = correrEscribir(home, ['--destino', 'claude', '--desde', desde]);
    assert.equal(bien.status, 0, bien.stderr);
    const r = JSON.parse(bien.stdout);
    assert.ok(r.respaldo && existsSync(r.respaldo));
    const final = readFileSync(join(home, '.claude', 'CLAUDE.md'), 'utf8');
    assert.ok(final.startsWith('lo mío') && final.includes('mi perfil'));
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('activar la actualización conserva el resto de la configuración', () => {
  const previo = { model: 'sonnet', extraKnownMarketplaces: { otro: { autoUpdate: false } }, hooks: { Stop: [] } };
  const nuevo = conActualizacion(previo, { source: 'github', repo: 'org/tpp-claude-kit' });
  assert.equal(nuevo.model, 'sonnet');
  assert.deepEqual(nuevo.hooks, { Stop: [] });
  assert.deepEqual(nuevo.extraKnownMarketplaces.otro, { autoUpdate: false });
  assert.equal(nuevo.extraKnownMarketplaces['tpp-claude-kit'].autoUpdate, true);
  assert.equal(previo.extraKnownMarketplaces['tpp-claude-kit'], undefined, 'no debe mutar el objeto original');
});

test('estado de actualización y plugins instalados se leen de los archivos de Claude Code', () => {
  const home = temporal();
  try {
    mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
    writeFileSync(join(home, '.claude', 'plugins', 'known_marketplaces.json'), JSON.stringify({ 'tpp-claude-kit': { source: { source: 'github', repo: 'org/tpp-claude-kit' } } }));
    writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: {
      'tpp@tpp-claude-kit': [{ version: 'abc123', installPath: '/x/tpp' }],
      'otro@otro-mkt': [{ version: '1', installPath: '/x/otro' }],
    } }));
    writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'tpp@tpp-claude-kit': true } }));
    const estado = estadoActualizacion(home);
    assert.equal(estado.registrado, true);
    assert.equal(estado.activa, false);
    const plugins = pluginsInstalados(home);
    assert.deepEqual(Object.keys(plugins), ['tpp']);
    assert.equal(plugins.tpp.habilitado, true);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('el diagnóstico corre completo aunque falten cosas', async () => {
  const r = await diagnosticar();
  assert.ok(Array.isArray(r.checks) && r.checks.length > 5);
  for (const c of r.checks) assert.ok(['ok', 'falta', 'aviso', 'opcional'].includes(c.estado), c.id);
});

test('cada plugin con reglas las carga en el contexto, y el hook responde JSON válido', () => {
  for (const p of readdirSync(join(RAIZ, 'plugins'))) {
    const dir = join(RAIZ, 'plugins', p, 'reglas');
    if (!existsSync(dir)) continue;
    const texto = armarContexto(dir, p);
    assert.ok(texto.includes(`Reglas del kit TPP — ${p}`), p);
    assert.ok(!texto.includes('\n---\n'), `${p}: quedó frontmatter en el contexto`);
    const r = spawnSync(process.execPath, [join(RAIZ, 'plugins', p, 'hooks', 'cargar-reglas.mjs')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const salida = JSON.parse(r.stdout);
    assert.equal(salida.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.ok(salida.hookSpecificOutput.additionalContext.length > 100);
  }
});

test('el diagnóstico detecta disableAllHooks en el proyecto y hooks faltantes en los candados', () => {
  const dir = temporal();
  try {
    mkdirSync(join(dir, 'proyecto', '.claude'), { recursive: true });
    writeFileSync(join(dir, 'proyecto', '.claude', 'settings.json'), JSON.stringify({ disableAllHooks: true }));
    assert.equal(hooksApagadosEn(dir, join(dir, 'proyecto')).length, 1);
    assert.equal(hooksApagadosEn(dir, dir).length, 0);
    assert.deepEqual(hooksFaltantes(join(RAIZ, 'plugins', 'tpp-guardrails')), []);
    mkdirSync(join(dir, 'candados', 'hooks'), { recursive: true });
    writeFileSync(join(dir, 'candados', 'hooks', 'hooks.json'), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ command: 'node secretos-pegados.mjs' }] }] } }));
    assert.equal(hooksFaltantes(join(dir, 'candados')).length, 3);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el origen del kit tiene que ser el repo oficial, no un fork con el mismo nombre', () => {
  const casos = [
    [{ source: 'github', repo: REPO_OFICIAL }, 'oficial'],
    [{ source: 'github', repo: REPO_OFICIAL.toUpperCase() }, 'oficial'],
    [{ source: 'git', url: `https://github.com/${REPO_OFICIAL}.git` }, 'oficial'],
    [{ source: 'github', repo: 'alguien/tpp-claude-kit' }, 'ajeno'],
    [{ source: 'git', url: `https://github.com/${REPO_OFICIAL}-falso.git` }, 'ajeno'],
    [{ source: 'directory', path: '/Users/x/tpp-claude-kit' }, 'local'],
  ];
  for (const [source, esperado] of casos) {
    const home = temporal();
    try {
      mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
      writeFileSync(join(home, '.claude', 'plugins', 'known_marketplaces.json'), JSON.stringify({ 'tpp-claude-kit': { source } }));
      assert.equal(origenDelKit(home).estado, esperado, JSON.stringify(source));
    } finally { rmSync(home, { recursive: true, force: true }); }
  }
  assert.equal(origenDelKit(temporal()).estado, 'ausente');
});
