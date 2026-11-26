# Kit de Claude de TPP

Marketplace de plugins de Claude Code para los equipos de TPP. Lo mantiene Guie Porras.

- **Para las personas del equipo:** [ONBOARDING.md](ONBOARDING.md).
- **Este README** es para quien mantiene el kit.

## Qué trae

| Plugin | Para quién | Qué contiene |
|---|---|---|
| `tpp` | Todos | 8 reglas de trabajo (se cargan en cada sesión), wizard `/tpp:bienvenida`, `/tpp:revision`, `/tpp:mi-flujo`, `/tpp:diagnostico` y 3 agentes universales: `guardian-confidencialidad`, `qa-claims-marca`, `verificador-cifras` |
| `tpp-guardrails` | Todos, obligatorio | 4 hooks: conectores de Meta, Google y TikTok Ads en solo lectura (lista cerrada, ver abajo), bloqueo de credenciales pegadas en el chat, bloqueo de intentos de apagar los candados desde la sesión (`disableAllHooks`, desinstalarlos, un Claude anidado) y un latido al iniciar sesión que prueba que corren |
| `tpp-pauta` | Pauta | Regla de pauta, agente `analista-pauta`, `/tpp-pauta:reporte` |
| `tpp-sac` | Servicio al cliente | Regla de SAC, agentes `triage-sac`, `redactor-respuestas`, `qa-sop`, `/tpp-sac:respuesta` |
| `tpp-diseno` | Diseño | Regla de diseño, agentes `estrategia-creativa`, `brand-manager`, `/tpp-diseno:brief` |
| `tpp-automatizaciones` | Automatizaciones | Regla de automatizaciones, agentes `arquitecto-automatizaciones`, `integrador`, `auditor-credenciales`, `/tpp-automatizaciones:nuevo-flujo` |

Máximo 3 agentes universales + 3 por equipo. Las decisiones técnicas difíciles de revertir se escalan a quien mantiene el kit.

## Estructura

```
.claude-plugin/marketplace.json   catálogo de plugins
kit.config.json                   fuente única: repo, nombres, Node mínimo
shared/cargar-reglas.mjs          hook que carga reglas/*.md; se copia a cada plugin
plugins/<plugin>/reglas/*.md      reglas de negocio (las edita el dueño de cada equipo por PR)
plugins/tpp/scripts/              diagnóstico, escritura del perfil, actualización automática, reglas para Codex/Gemini
plugins/tpp-guardrails/hooks/     candados y su verificación (verificar.mjs)
install/                          instaladores para Mac y Windows
tests/                            validación del repo y pruebas de los candados
```

## Cómo se cambia algo

1. Rama nueva, cambio, `npm test` en verde.
2. PR. El CI corre en Ubuntu y Windows.
3. Merge a `main` (protegida: no se puede empujar directo). **Lo que entra a `main` les llega a todos** con la próxima actualización automática: los plugins no fijan versión, así que la versión es el commit.

### Reglas

Cada archivo en `reglas/` lleva frontmatter con `id`, `titulo`, `version`, `dueno` y `aplica`. Subí `version` cuando cambie el sentido de la regla. Los `id` no se repiten en todo el kit.

### Agregar una herramienta de lectura a los candados

1. Comprobá en la documentación oficial que la herramienta solo lee.
2. Agregala a `plugins/tpp-guardrails/hooks/ads-readonly-allowlist.json`.
3. Agregá su caso en `CASOS` de `verificar.mjs`.

Si una herramienta de la lista tiene nombre de escritura (`create`, `update`, `delete`, `transfer`, `mutate`…), falla el CI y falla `/tpp:diagnostico` en la máquina de cada persona: así una lista adulterada en una computadora también se detecta.

### Cómo decide el candado de pauta

Una herramienta se trata como de pauta si **cualquiera** de estas cosas la delata: el nombre del conector, la conexión real (URL o comando, normalizados contra disfraces), la firma de la herramienta (`ads_*` de Meta, familias de TikTok, `mutate` de Google). Solo un conector de `servidores_ajenos` cuya conexión declara el usuario en `~/.claude.json` como no de pauta queda eximido; el `.mcp.json` de un proyecto puede endurecer pero nunca eximir. Cada regla tiene su caso adversarial en `verificar.mjs`, probado contra la versión anterior del hook.

**Pendiente:** si se distribuye el conector propio de gasto de pauta (solo lectura), sus herramientas se agregan a la lista con sus casos.

### Cambiar el repo o el nombre del marketplace

Editá `kit.config.json` y corré `npm run sincronizar`: actualiza los instaladores y la documentación.

## Probar local sin publicar

Desde la carpeta del repo:

```
claude plugin marketplace add ./
claude plugin install tpp@tpp-claude-kit
claude plugin install tpp-guardrails@tpp-claude-kit
```

Para sacarlo: `claude plugin marketplace remove tpp-claude-kit`.

## Conectar el kit publicado

```
claude plugin marketplace add tpp-kit/tpp-claude-kit
```

## Límites conocidos

- **Los candados son la última capa, no la primera.** La primera es que cada usuario tenga **rol de solo lectura** en Meta, Google y TikTok. Los hooks no corren en el chat de claude.ai, no corren si falta Node, y Codex y Gemini no los tienen.
- **Si falta Node o una configuración pone `disableAllHooks`,** los hooks no corren. `/tpp:diagnostico` lo detecta: revisa la configuración y busca en la sesión la marca `CANDADOS-TPP-ACTIVOS` que deja el latido.
- **Codex y Gemini:** el asistente les copia las reglas como texto y avisa que ahí no se conectan los conectores de pauta.
- **Lo que entra a `main` se ejecuta en todas las máquinas del equipo.** Es el riesgo de cadena de suministro más grande del kit. Por eso `main` está protegida: todo cambio entra por PR con el CI en verde en Ubuntu y Windows, sin force-push ni borrado, y solo quien mantiene el kit puede escribir. El repo es público para que el equipo lo instale sin cuentas de GitHub; nunca lleva datos de clientes ni secretos.
- **Windows nativo no tiene el mismo aislamiento que WSL2.** El kit funciona en Windows nativo; no requiere WSL.
- **Los instaladores no están firmados.** Windows puede avisar "protegió su equipo" y macOS puede pedir confirmación: el ONBOARDING explica qué hacer.
