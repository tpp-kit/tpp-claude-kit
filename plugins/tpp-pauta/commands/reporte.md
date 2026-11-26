---
description: Arma un reporte de pauta de un cliente para un período, con cifras citadas y recomendaciones como propuesta.
argument-hint: [cliente] [período, por ejemplo "semana pasada" o "1 al 15 de noviembre"]
---

Pedido: $ARGUMENTS

1. Confirmá en una línea el **cliente**, las **cuentas y plataformas** y el **período exacto** (con fechas). Si falta algo, preguntá.
2. Pedile al agente `tpp-pauta:analista-pauta` el análisis del período contra el período anterior equivalente.
3. Armá el reporte con esta estructura:
   - **Resumen** en 3 líneas: cuánto se gastó, qué se logró y lo más importante a mirar.
   - **Por plataforma:** gasto, resultados, costo por resultado y variación. Cada cifra con su fuente y fecha.
   - **Lo que llama la atención:** anomalías y su posible causa, separando dato de interpretación.
   - **Propuestas:** qué cambiar, por qué y cómo se mide. Aclarar que las ejecuta el equipo en la plataforma.
   - **Notas sobre los datos:** frescura, datos incompletos y ventanas de atribución.
4. Usá la identidad de la marca del cliente si el reporte va en documento.
5. Antes de entregar, sugerí `/tpp:revision` sobre el reporte.
