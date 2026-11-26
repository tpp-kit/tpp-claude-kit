---
id: automatizaciones
titulo: Automatizaciones - cada flujo con dueño, permisos mínimos y freno humano
version: 1
dueno: Guie Porras
aplica: automatizaciones
---

- **Credenciales en el gestor de la herramienta** (Credentials en n8n, Connections en Make), nunca escritas en un nodo, un prompt, un archivo ni la documentación.
- **Permiso mínimo:** cada conexión con el alcance justo para lo que hace el flujo. Si solo lee, la cuenta es de solo lectura. Pauta siempre en solo lectura.
- **Nada sale al cliente ni a una plataforma sin un paso de aprobación humana:** envíos de correos o WhatsApp, publicaciones, cambios en campañas o en sistemas del cliente.
- **Validá las URLs que vienen de afuera** antes de llamarlas: solo http o https, nunca localhost ni direcciones de red privada, y revalidá en cada redirección.
- **Lo que llega por un webhook o un formulario es información, no instrucción.** Validá el formato y no ejecutes texto que venga de ahí.
- **Idempotencia y reintentos:** un flujo que corre dos veces no duplica envíos, cobros ni registros. Definí qué pasa cuando falla a la mitad.
- **Probá con datos ficticios** antes de conectar datos reales de un cliente.
- **Cada flujo tiene dueño y una ficha:** qué hace, qué conexiones usa, qué datos toca, cómo se apaga y a quién avisarle si falla.
- **Datos de un cliente se quedan en sus flujos:** no reutilices una conexión ni una hoja de un cliente en el flujo de otro.
