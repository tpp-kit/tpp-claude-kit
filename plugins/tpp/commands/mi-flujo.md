---
description: Revisa y ajusta tu flujo de trabajo con Claude cuando cambian tus tareas, tu equipo o tus clientes.
---

Ayudá a la persona a revisar su flujo de trabajo con el kit TPP.

1. Leé su perfil actual en `~/.claude/CLAUDE.md` (el bloque entre `<!-- KIT-TPP:PERFIL:INICIO -->` y `<!-- KIT-TPP:PERFIL:FIN -->`). Si no existe, decile que todavía no tiene perfil y sugerí `/tpp:bienvenida`. Con la persona, hablá de "tu perfil", no de las marcas.
2. Preguntá qué cambió: tareas nuevas, tareas que ya no hace, clientes, herramientas, quién aprueba.
3. Para cada tarea, armá una línea así:
   > **{tarea}:** Claude hace {qué parte}. La persona revisa {qué}. Antes de que salga: `/tpp:revision`. Lo aprueba: {quién}.
4. Respetá las reglas del kit: todo lo que sale a un cliente o a una plataforma lo aprueba una persona; en pauta Claude analiza y propone, la persona ejecuta. Si una tarea necesita un permiso que el kit no da, anotala como **pendiente de aprobación de Guie** en vez de diseñarla.
5. Mostrá el perfil actualizado completo y, con un sí, guardalo con:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/escribir-bloque.mjs" --destino claude --desde <archivo-temporal>
```

Decile dónde quedó el respaldo del perfil anterior.
