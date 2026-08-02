const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const { MAX_QUEUE_SIZE, checkCooldown, cleanQuery } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o playlist')
    .addStringOption(option =>
      option.setName('cancion')
        .setDescription('Nombre o URL')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const query = cleanQuery(interaction.options.getString('cancion'));
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.reply('❌ Debes estar en un canal de voz.');

    const key = `${interaction.guildId}:${interaction.user.id}`;
    if (checkCooldown(key, 5000)) {
      return interaction.reply('⏳ Esperá unos segundos antes de pedir otra canción.');
    }

    const queue = client.distube.getQueue(interaction);
    if (queue && queue.songs.length >= MAX_QUEUE_SIZE) {
      return interaction.reply(`❌ La cola está llena (máximo ${MAX_QUEUE_SIZE} canciones).`);
    }

    await interaction.reply(`🔍 Buscando: \`${escapeMarkdown(query)}\``);
    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: interaction.member,
      });
    } catch (error) {
      console.error('Error al reproducir:', error);
      await interaction
        .editReply('❌ No se pudo reproducir. Probá con otro nombre o URL.')
        .catch(() => {});
    }
  },
};
