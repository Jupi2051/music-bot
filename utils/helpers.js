const MAX_QUEUE_SIZE = 100;

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

module.exports = { MAX_QUEUE_SIZE, checkCooldown, assertControl, cleanQuery, isPlaylistUrl };
