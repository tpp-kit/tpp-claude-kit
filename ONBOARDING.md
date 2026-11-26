# Bienvenida al kit de Claude de TPP

Este kit deja tu Claude listo para trabajar en TPP: con las reglas del equipo, con candados que protegen las cuentas de los clientes, y con asistentes pensados para tu área (pauta, servicio al cliente, diseño o automatizaciones).

Son cuatro pasos y unos 20 minutos.

## Paso 0 · Antes de empezar

Tené una **cuenta de Claude** que incluya Claude Code. Nada más.

Si Guie te avisa que el kit es **privado**, además:
1. Creá una cuenta en **github.com** (es gratis). El instalador te abre la página si no tenés.
2. Mandale tu **usuario de GitHub** a Guie.
3. Aceptá la **invitación** que te llega por correo desde GitHub antes de correr el instalador.

## Paso 1 · Correr el instalador

Guie te manda los archivos del instalador. Guardalos en tu carpeta **Descargas**.

**En Mac**
1. Abrí **Terminal**: apretá Cmd + Espacio, escribí *Terminal* y Enter.
2. Escribí `bash ` (con un espacio al final). No apretes Enter todavía.
3. Arrastrá el archivo `instalar-mac.sh` desde Descargas adentro de la ventana de Terminal.
4. Apretá Enter.

**En Windows**
1. Abrí la carpeta **Descargas**.
2. Hacé doble clic en `instalar-windows.bat` (tiene que estar en la misma carpeta que `instalar-windows.ps1`).
3. Si Windows dice que protegió tu equipo, tocá *Más información* y después *Ejecutar de todas formas*.

El instalador te pregunta antes de instalar cada cosa. **Para decir que sí, escribí `s` y apretá Enter.** Vas a ver textos largos corriendo: es normal, algunos pasos tardan varios minutos.

- En Mac te puede pedir la **contraseña con la que abrís tu computadora**. Al escribirla no se ve nada: es normal.
- En Windows puede aparecer una ventana pidiendo permiso para hacer cambios: aceptala.
- Solo si el kit es privado: en un momento se abre el navegador para que entres a GitHub.

## Paso 2 · Abrir Claude y correr el asistente de configuración

Cuando el instalador termine:

1. En la misma ventana (en Windows, abrí **PowerShell**: tecla Windows, escribí *PowerShell*, Enter), escribí `claude` y apretá Enter.
2. La primera vez te pide entrar con tu cuenta de Claude en el navegador.
3. Cuando estés adentro, escribí:

```
/tpp:bienvenida
```

El asistente revisa tu instalación, te hace unas preguntas sobre tu trabajo y arma tu configuración. Nunca te va a pedir contraseñas. Si se corta a la mitad, volvé a escribir `/tpp:bienvenida`: no se pierde nada.

## Paso 3 · Comprobar que quedó todo bien

1. Cerrá Claude (escribí `/exit` o cerrá la ventana) y abrilo de nuevo con `claude`.
2. Escribí `/tpp:diagnostico`.
3. Si dice **"Todo lo obligatorio está en orden"** y que **los candados corren en esta sesión**, terminaste.

## Lo que vas a usar todos los días

| Escribí | Para |
|---|---|
| `/tpp:revision` | Revisar un entregable antes de que salga: confidencialidad, marca y cifras. Tarda unos minutos. |
| `/tpp:mi-flujo` | Ajustar tu forma de trabajar o corregir algo que respondiste en la bienvenida |
| `/tpp:diagnostico` | Ver si algo dejó de funcionar |

Y según tu equipo. Si no sabés qué poner después del comando, escribilo solo y Claude te va preguntando.

| Equipo | Ejemplo |
|---|---|
| Pauta | `/tpp-pauta:reporte Cliente X semana pasada` |
| Servicio al cliente | `/tpp-sac:respuesta` y pegá el mensaje del cliente |
| Diseño | `/tpp-diseno:brief Cliente X, campaña de diciembre en Instagram` |
| Automatizaciones | `/tpp-automatizaciones:nuevo-flujo avisar por correo cuando entra un lead del formulario` |

## Lo que el kit hace y lo que no

- **Sí:** te recuerda las reglas del equipo en cada sesión, frena cualquier cambio en las cuentas de pauta (Claude solo mira y propone) y frena el mensaje si pegás una contraseña o una clave por error.
- **No:** no lee tus contraseñas, no envía nada a clientes por su cuenta y no publica nada sin tu aprobación.

## ¿Quién te ayuda?

**Guie Porras.** Cuando le escribas, mandale:

1. todo el texto que muestra `/tpp:diagnostico` (copiá y pegá);
2. si usás Mac o Windows;
3. qué estabas haciendo cuando falló.

Para conectar el kit a mano: `claude plugin marketplace add tpp-kit/tpp-claude-kit`, después `claude plugin install tpp@tpp-claude-kit` y `claude plugin install tpp-guardrails@tpp-claude-kit`.
