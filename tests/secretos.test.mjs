import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectar, PATRONES } from '../plugins/tpp-guardrails/hooks/secretos-pegados.mjs';

// Las credenciales de prueba se arman en partes para que el repo no contenga cadenas con forma de token.
const j = (...partes) => partes.join('');
const POSITIVOS = {
  'llave de Anthropic': j('sk-', 'ant-', 'api03-', 'a'.repeat(30)),
  'llave de OpenAI': j('sk-', 'proj-', 'B'.repeat(40)),
  'token de GitHub': j('gh', 'o_', 'C'.repeat(36)),
  'llave de Google': j('AI', 'za', 'D'.repeat(35)),
  'secreto OAuth de Google': j('GOC', 'SPX-', 'e'.repeat(28)),
  'llave de AWS': j('AK', 'IA', 'F'.repeat(16)),
  'token de Slack': j('xo', 'xb-', '1234567890-abcdef'),
  'token de Meta': j('EA', 'AB', 'g'.repeat(80)),
  'llave de Stripe': j('sk', '_live_', 'H'.repeat(24)),
  'token JWT': j('ey', 'JhbGciOiJIUzI1NiJ9', '.', 'ey', 'JzdWIiOiIxMjM0NTYifQ', '.', 'abcdefghijklmnop'),
  'llave privada': j('-----BEGIN ', 'RSA ', 'PRIVATE KEY-----'),
  'contraseña': j('el acceso es contraseña', ': Clave2026!'),
  'token de GitLab': j('gl', 'pat-', 'k'.repeat(24)),
  'token OAuth de Google': j('ya', '29.', 'm'.repeat(30)),
  'token de Shopify': j('sh', 'pat_', 'a1'.repeat(16)),
  'llave de SendGrid': j('S', 'G.', 'n'.repeat(22), '.', 'p'.repeat(40)),
  'token de Notion': j('nt', 'n_', 'q'.repeat(44)),
  'token de HubSpot': j('pat-', 'na1-', '12345678-abcd-ef01-2345-6789abcdef01'),
  'token de bot de Telegram': j('123456789', ':AA', 'r'.repeat(33)),
  'usuario y clave dentro de una URL': j('https://admin', ':Verano', '2026!@n8n.ejemplo.com/webhook'),
};

// Variantes que la auditoría ofensiva usó para pasar el detector: todas tienen que frenarse.
const VARIANTES = [
  j('la clave', ': Verano2026!'),
  j('la contraseña es ', 'Verano2026!'),
  j('contraseña: "', 'Verano2026!', '"'),
  j('gh', 'p_', 'ABCDEFGHIJ', '​', 'KLMNOPQRSTUVWXYZabcdefghij'),
  j('1/', '/0', 's'.repeat(40)),
];

// Mensajes normales de trabajo en español que NO deben bloquearse. Si se agrega un patrón,
// se mide contra esta lista: un detector que frena el trabajo diario no sirve.
const NEGATIVOS = [
  'armá el reporte semanal de pauta del cliente con el gasto por plataforma',
  '¿cómo renuevo el token de acceso de Meta cuando vence?',
  'la clave: entender por qué subió el costo por resultado',
  'necesito cambiar la contraseña del correo, ¿cómo lo hago?',
  'contraseña: cambiarla mañana sin falta',
  'la política de password del cliente pide 12 caracteres',
  'el archivo sk-informe-final.pdf está en la carpeta',
  'el ID de la campaña es 120210345678901234 y el del conjunto 120210345678909999',
  'el hash del commit es 9cb4fe4099195b2587c402117a3efce6ab5aac78',
  'el pedido EAA-2026-0042 llegó tarde',
  'usá AIza como ejemplo de prefijo de llave de Google en la capacitación',
  'el cliente pidió "100% garantizado" en el copy; marcalo para revisión',
  'https://www.facebook.com/business/help/1234567890 explica los roles',
  // Bloqueos accidentales que encontró la auditoría ofensiva
  'contraseña: no-la-tengo',
  'cambiaron la contraseña: restablecida.',
  'el password: pendiente_de_cambio',
  'pwd: C:\\Users\\maria.lopez\\Documentos',
  'subí sk-campana-navidad-marca-2026-final-v3.png a la carpeta del cliente',
  'la hora de la reunión es 10:30 y el link es https://meet.google.com/abc-defg-hij',
];

test('las variantes con que se intentó pasar el detector se frenan', () => {
  for (const v of VARIANTES) assert.ok(detectar(v), `no se frenó: ${JSON.stringify(v)}`);
});

test('cada patrón tiene un caso positivo y lo detecta', () => {
  for (const [nombre] of PATRONES) {
    assert.ok(POSITIVOS[nombre], `falta caso positivo para "${nombre}"`);
    assert.equal(detectar(POSITIVOS[nombre]), nombre, nombre);
  }
});

test('ningún mensaje normal de trabajo se bloquea', () => {
  const accidentes = NEGATIVOS.filter((t) => detectar(t));
  assert.deepEqual(accidentes, [], `bloqueos accidentales: ${accidentes.map((t) => `"${t}" → ${detectar(t)}`).join('; ')}`);
});

test('texto vacío o raro no rompe el detector', () => {
  assert.equal(detectar(''), null);
  assert.equal(detectar(undefined), null);
  assert.equal(detectar(42), null);
});
