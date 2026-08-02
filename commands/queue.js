const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Muestra la cola de reproducción'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply('📭 La cola está vacía.');

    const songs = queue.songs
      .map((song, i) => `${i === 0 ? '🎶' : `${i}.`} ${escapeMarkdown(song.name)}`)
      .join('\n');
    await interaction.reply(`📀 **Cola actual:**\n${songs}`);
  },
};
