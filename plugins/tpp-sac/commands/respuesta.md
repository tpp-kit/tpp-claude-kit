---
description: Prepara un borrador de respuesta a un caso de servicio al cliente, con triage y nota para quien lo envía.
argument-hint: [el mensaje del cliente o dónde está el caso]
---

Caso: $ARGUMENTS

1. Pedile al agente `tpp-sac:triage-sac` que clasifique el caso. Si la urgencia es alta o hay que escalar, decilo primero y preguntá si igual se prepara un borrador.
2. Pedile al agente `tpp-sac:redactor-respuestas` el borrador con la voz de la marca y la política del cliente.
3. Entregá:
   - el triage en 3 líneas;
   - el **borrador** listo para copiar;
   - lo que la persona tiene que **confirmar antes de enviar**.
4. Recordá que el envío lo hace la persona. No envíes nada.
