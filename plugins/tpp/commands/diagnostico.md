---
description: Revisa que el kit TPP esté bien instalado y que los candados de seguridad estén corriendo en esta sesión.
---

1. Fijate si en el contexto de esta sesión aparece la marca **CANDADOS-TPP-ACTIVOS**. Esa marca la deja el kit al empezar la sesión: es la prueba de que Claude está ejecutando los candados. Si no aparece, los candados **no** están corriendo, aunque el diagnóstico diga que están instalados.
2. Ejecutá:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

3. Contá el resultado en lenguaje simple: qué está bien, qué falta y cómo se arregla. Empezá por lo más importante:
   - Si **no** aparece la marca, o el diagnóstico marca `candados-funcionan`, `candados-declarados` o `hooks-encendidos` como FALTA: decí claramente que **no use los conectores de pauta** hasta que Guie lo revise, y que le mande todo el texto del diagnóstico.
   - Si todo está bien, decí: **"Todo lo obligatorio está en orden y los candados corren en esta sesión."**
4. Si algo falta, ofrecé el arreglo y aplicalo solo con un "sí" explícito. Nunca pidas contraseñas ni tokens.
