---
description: Diseña una automatización nueva en n8n o Make, con su ficha y la revisión de credenciales antes de activarla.
argument-hint: [qué querés automatizar]
---

Necesidad: $ARGUMENTS

1. Preguntá lo que falte: para qué cliente, qué sistemas conecta, con qué frecuencia y qué sale hacia afuera.
2. Pedile al agente `tpp-automatizaciones:arquitecto-automatizaciones` el diseño completo y la ficha del flujo.
3. Si conecta un sistema nuevo, pedile al agente `tpp-automatizaciones:integrador` el detalle de autenticación, mapeo de datos y límites.
4. Antes de que la persona lo active, pedile al agente `tpp-automatizaciones:auditor-credenciales` que revise el diseño. Si el veredicto es `NO SALE`, no se activa.
5. Entregá el diseño, la ficha y el resultado de la auditoría. Recordá: primero se prueba con datos ficticios.
