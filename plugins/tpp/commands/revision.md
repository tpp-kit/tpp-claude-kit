---
description: Revisión antes de entregar. Tres revisores independientes (confidencialidad, marca y afirmaciones, cifras) miran el entregable en paralelo y dan un veredicto único.
argument-hint: [archivo, carpeta o descripción del entregable]
---

# Revisión antes de entregar

Entregable a revisar: $ARGUMENTS

Si no está claro qué revisar, preguntá qué archivo o texto es y para qué cliente.

## Cómo se hace

1. Confirmá en una línea **qué** se revisa y **para qué cliente** es, y avisá: "Lo reviso con 3 revisores independientes; tarda unos minutos."
2. Lanzá **en paralelo** estos tres agentes, cada uno con el mismo material y sin tu opinión previa:
   - `tpp:guardian-confidencialidad`
   - `tpp:qa-claims-marca`
   - `tpp:verificador-cifras` (solo si el entregable tiene cifras)
3. Si está instalado el plugin del equipo y tiene un revisor de su especialidad (por ejemplo `tpp-pauta:analista-pauta` para un reporte de pauta o `tpp-sac:qa-sop` para un procedimiento de SAC), sumalo como cuarto revisor. Nunca más de cuatro.
4. Consolidá:
   - El veredicto final es el **más estricto** de los revisores: `NO SALE` > `CORREGIR` > `LISTO`.
   - Si dos revisores marcan lo mismo, mostralo una sola vez.
   - Si un revisor dice "no pude verificar", eso no es un `LISTO`: queda como pendiente para una persona.

## Cómo se entrega el resultado

- Primera línea: el veredicto en grande (**LISTO**, **CORREGIR** o **NO SALE**).
- Después, la lista de cosas a corregir, de la más grave a la menos grave, cada una con dónde está y cómo se arregla.
- Al final, lo que no se pudo verificar.

No corrijas el entregable por tu cuenta. Ofrecé hacerlo y esperá un sí.
