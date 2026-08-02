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

module.exports = { MAX_QUEUE_SIZE, checkCooldown, assertControl };
