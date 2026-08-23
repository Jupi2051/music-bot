const path = require('path');

const MAX_QUEUE_SIZE = 100;

// Tamaño mínimo razonable del binario de yt-dlp (~3MB real). Menos que esto
// = descarga truncada/vacía: el síntoma es que las búsquedas funcionan (van
// por SoundCloud) pero los ENLACES fallan (yt-dlp no puede ejecutarse).
const YT_DLP_MIN_BYTES = 1024 * 1024;

// Guarda `{ at: timestamp }` por key para limpiar entradas vencidas y evitar
// que el Map crezca sin límite en servidores con mucho uso.
const cooldowns = new Map();

function checkCooldown(key, ms) {
  const now = Date.now();

  // Podar entradas vencidas: se recorre solo el Map, que es chico en la
  // práctica (una key por canal/acción). Evita leaks de memoria.
  for (const [storedKey, entry] of cooldowns) {
    if (now - entry.at >= ms) cooldowns.delete(storedKey);
  }

  const entry = cooldowns.get(key);
  if (entry && now - entry.at < ms) return true;
  cooldowns.set(key, { at: now });
  return false;
}

function assertControl(interaction, botChannelId) {
  const memberChannel = interaction.member?.voice?.channel;
  if (!memberChannel) return '❌ Debes estar en un canal de voz.';
  if (botChannelId && memberChannel.id !== botChannelId) {
    return '❌ Debes estar en el mismo canal de voz que el bot.';
  }
  return null;
}

// Normaliza el query del usuario. Si pegó el texto del mensaje del bot
// (ej: `🔍 Buscando: \`https://...\``) o una URL envuelta en backticks,
// extrae la URL real. Si no hay URL, devuelve el texto limpio.
function cleanQuery(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.trim();
  const urlMatch = text.match(/https?:\/\/[^\s'`"<>]+/);
  if (urlMatch) {
    // Recortar puntuación de cierre pegada a la URL (ej: "https://...youtube.com/watch?v=x).")
    // que los usuarios suelen incluir al copiar desde el chat o el navegador.
    return urlMatch[0].replace(/[.,;:!?)]+$/, '');
  }
  if (text.length > 1 && text.startsWith('`') && text.endsWith('`')) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

// Detecta si una query es una URL de playlist/álbum/radio (YouTube, Spotify,
// SoundCloud) para mostrar el mensaje de carga adecuado. El set es explícito:
// agregar una fuente nueva acá actualiza tanto este check como la UX.
function isPlaylistUrl(raw) {
  if (typeof raw !== 'string') return false;
  return /(youtube\.com|youtu\.be).*(playlist|list=)|open\.spotify\.com\/(playlist|album)|soundcloud\.com\/[^/]+\/sets\//.test(raw);
}

// Devuelve un mensaje de error si el query es inseguro (null si es seguro).
// Seguridad: bloquea inyección de flags de yt-dlp (queries que empiezan con "-")
// y protocolos no-http(s) (LFI vía file://).
function getQueryError(query) {
  if (typeof query !== 'string' || !query.trim()) return '❌ Ingresá un nombre o URL.';
  if (query.startsWith('-')) return '❌ Ese término de búsqueda no es válido.';
  const protocolMatch = query.match(/^[a-z][a-z0-9+.-]*:\/\//i);
  if (protocolMatch && !/^https?:\/\//i.test(query)) return '❌ Solo se admiten enlaces http(s).';
  return null;
}

// Veredicto puro sobre el binario de yt-dlp (testeable sin fs), mismo patrón
// que evaluateHealth en healthcheck.js. Se usa para fallar rápido al arrancar
// con un mensaje accionable en vez de fallar por enlace a mitad de sesión.
function evaluateYtDlpBinary({ exists, size }) {
  const fix = 'Arreglalo con `npm run setup:ytdlp` (local) o recontruyendo la imagen (`docker compose build`) en Docker.';
  if (!exists) {
    return { ok: false, reason: `❌ Falta el binario de yt-dlp (${fix})` };
  }
  if (!Number.isFinite(size) || size < YT_DLP_MIN_BYTES) {
    return { ok: false, reason: `❌ El binario de yt-dlp está vacío o truncado (${size ?? 'tamaño desconocido'} bytes). ${fix}` };
  }
  return { ok: true };
}

// Resuelve la ruta del binario de yt-dlp igual que lo hace @distube/yt-dlp
// internamente (env.ts): honra YTDLP_DIR/YTDLP_FILENAME para no divergir.
function ytDlpBinaryPath() {
  const dir = process.env.YTDLP_DIR || path.join(path.dirname(require.resolve('@distube/yt-dlp')), '..', 'bin');
  const filename = process.env.YTDLP_FILENAME || `yt-dlp${process.platform === 'win32' ? '.exe' : ''}`;
  return path.join(dir, filename);
}

module.exports = { MAX_QUEUE_SIZE, YT_DLP_MIN_BYTES, checkCooldown, assertControl, cleanQuery, isPlaylistUrl, getQueryError, evaluateYtDlpBinary, ytDlpBinaryPath };
