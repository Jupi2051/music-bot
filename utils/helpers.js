const MAX_QUEUE_SIZE = 100;

const cooldowns = new Map();

function checkCooldown(key, ms) {
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < ms) return true;
  cooldowns.set(key, now);
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
  if (urlMatch) return urlMatch[0];
  if (text.length > 1 && text.startsWith('`') && text.endsWith('`')) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

module.exports = { MAX_QUEUE_SIZE, checkCooldown, assertControl, cleanQuery };
