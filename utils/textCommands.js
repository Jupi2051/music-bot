'use strict';

// Text/prefix command support, layered on top of the existing slash commands.
// Every command still lives in commands/*.js with a single execute(interaction,
// client) — this module just builds a fake "interaction" out of a Message so
// that same execute() runs unmodified whether it was triggered by a slash
// command or by typing "<prefix><command> [args]" in a text channel.

// Aliases for text-prefix commands. Keys are canonical slash command names
// (must match a commands/*.js `data.name`); values are extra tokens that also
// resolve to that command. Matching is case-insensitive. Add more aliases
// here freely — nothing else needs to change.
const ALIASES = {
  play: ['p'],
  stop: ['st'],
  skip: ['s', 'next'],
  pause: ['ps'],
  resume: ['r', 'unpause'],
  queue: ['q', 'list'],
  volume: ['v', 'vol'],
  set: ['seek'],
  leave: ['l', 'dc'],
  help: ['h'],
  nowplaying: ['np', 'now'],
};

function getPrefix() {
  const raw = process.env.PREFIX;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed || 'Chl';
}

// token (canonical name or alias, any case) -> canonical command name
function buildAliasLookup() {
  const lookup = new Map();
  for (const [name, aliases] of Object.entries(ALIASES)) {
    lookup.set(name.toLowerCase(), name);
    for (const alias of aliases) lookup.set(alias.toLowerCase(), name);
  }
  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

// Resolves a typed token to a registered slash command via ALIASES, falling
// back to a direct client.commands lookup so any command without a declared
// alias still works under its full name.
function resolveCommand(client, token) {
  const lower = token.toLowerCase();
  const canonicalName = ALIAS_LOOKUP.get(lower) || lower;
  return client.commands.get(canonicalName);
}

function toMessagePayload(input) {
  if (typeof input === 'string') return { content: input };
  const payload = {};
  if (input.content !== undefined) payload.content = input.content;
  if (input.embeds !== undefined) payload.embeds = input.embeds;
  return payload;
}

// Wraps a Message + the text after the command name in an object that
// duck-types just enough of discord.js's Interaction for command.execute()
// to run unchanged: .options.getString()/.getInteger(), .reply()/.editReply()
// (tracking the sent message so editReply has something to edit), and the
// member/guild/channel/user/guildId properties the commands read directly.
function createFakeInteraction(message, argString) {
  const arg = (argString || '').trim();

  const interaction = {
    isTextCommand: true,
    member: message.member,
    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    user: message.author,
    replied: false,
    deferred: false,
    _lastReply: null,
    options: {
      getString: () => arg,
      getInteger: () => Number.parseInt(arg, 10),
    },
    async reply(input) {
      const sent = await message.channel.send(toMessagePayload(input));
      interaction.replied = true;
      interaction._lastReply = sent;
      return sent;
    },
    async editReply(input) {
      if (interaction._lastReply) return interaction._lastReply.edit(toMessagePayload(input));
      return interaction.reply(input);
    },
  };

  return interaction;
}

// Entry point for events/messageCreate.js. Returns true if the message was
// handled as a text command.
async function handleTextCommand(message, client) {
  if (message.author.bot || !message.guild) return false;

  const prefix = getPrefix();
  if (message.content.length < prefix.length) return false;
  if (message.content.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) return false;

  const match = message.content.slice(prefix.length).match(/^\s*(\S+)\s*([\s\S]*)$/);
  if (!match) return false;
  const [, token, argString] = match;

  const command = resolveCommand(client, token);
  if (!command) return false;

  const interaction = createFakeInteraction(message, argString);
  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Error in text command ${token}:`, error);
    const content = '❌ An error occurred.';
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content }).catch(() => {});
    } else {
      await interaction.reply({ content }).catch(() => {});
    }
  }
  return true;
}

module.exports = { ALIASES, getPrefix, resolveCommand, createFakeInteraction, handleTextCommand };
