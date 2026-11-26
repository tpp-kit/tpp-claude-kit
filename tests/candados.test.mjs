import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { verificar } from '../plugins/tpp-guardrails/hooks/verificar.mjs';
import { decidir, classifyTool } from '../plugins/tpp-guardrails/hooks/ads-readonly.mjs';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'tpp-guardrails', 'hooks');

test('los candados responden bien en todos los casos, ejecutados como procesos', () => {
  const r = verificar();
  assert.ok(r.ok, r.detalle);
});

test('sin lista permitida, todo lo de pauta se bloquea y lo demás pasa', () => {
  const opciones = { allowlistPath: join(HOOKS, 'no-existe.json'), home: tmpdir() };
  const entrada = (tool) => JSON.stringify({ tool_name: tool, cwd: tmpdir() });
  assert.match(decidir(entrada('mcp__meta-ads__ads_get_ad_accounts'), opciones), /no se pudo leer la lista/);
  assert.equal(decidir(entrada('mcp__notion__search'), opciones), null);
});

test('sin lista permitida, un alias conectado a una plataforma de pauta también se bloquea', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-tpp-sinlista-'));
  try {
    writeFileSync(join(dir, '.claude.json'), JSON.stringify({ mcpServers: { reportes: { url: 'https://googleads.googleapis.com/mcp' } } }));
    // Una herramienta sin "mutate": así solo la resolución de la conexión puede delatarla.
    const r = decidir(JSON.stringify({ tool_name: 'mcp__reportes__customers_list_accessible_customers', cwd: dir }), { allowlistPath: join(dir, 'no-existe.json'), home: dir });
    assert.match(r || '', /no se pudo leer la lista/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el latido del inicio de sesión deja la marca que busca el diagnóstico', async () => {
  const { spawnSync } = await import('node:child_process');
  const { MARCA_LATIDO } = await import('../plugins/tpp-guardrails/hooks/latido.mjs');
  const r = spawnSync(process.execPath, [join(HOOKS, 'latido.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const contexto = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.ok(contexto.startsWith(MARCA_LATIDO) && /\d+ herramientas/.test(contexto), contexto);
});

test('una lista con la plataforma vacía no deja pasar nada de esa plataforma', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-tpp-lista-'));
  try {
    const lista = join(dir, 'lista.json');
    writeFileSync(lista, JSON.stringify({ servers: {} }));
    const r = decidir(JSON.stringify({ tool_name: 'mcp__tiktok-ads__campaign_get', cwd: dir }), { allowlistPath: lista, home: dir });
    assert.match(r, /puede cambiar algo/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el .mcp.json del proyecto también ata el alias a la plataforma real', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-tpp-proyecto-'));
  try {
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { reportes: { url: 'https://business-api.tiktok.com/mcp' } } }));
    const r = decidir(JSON.stringify({ tool_name: 'mcp__reportes__campaign_create', cwd: dir }), { home: dir });
    assert.ok(r, 'debía bloquearse');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('la clasificación detecta la plataforma por nombre aunque cambie el formato', () => {
  for (const nombre of ['mcp__Meta_Ads__ads_get_ad_accounts', 'mcp__facebook-ads__x_y', 'mcp__TikTok__campaign_get', 'mcp__adwords__search_search']) {
    assert.ok(classifyTool(nombre).platform, nombre);
  }
});
