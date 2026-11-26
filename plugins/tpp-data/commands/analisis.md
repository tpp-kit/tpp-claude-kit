---
description: Responde una pregunta de negocio con datos, en solo lectura y de forma reproducible, y lo revisa antes de compartirlo.
argument-hint: [la pregunta, el período y la fuente si la sabés]
---

Pregunta: $ARGUMENTS

1. Confirmá la **pregunta**, el **período**, el **cliente o unidad** y cómo se define cada métrica. Preguntá lo que falte.
2. Pedile al agente `tpp-data:analista-datos` el análisis en solo lectura, con fuente, consulta y fecha de cada número.
3. Antes de compartir, pedile al agente `tpp-data:auditor-datos` que lo revise.
4. Entregá la respuesta corta, el detalle y las limitaciones. Si va a otra área o a un cliente, sugerí `/tpp:revision`.
