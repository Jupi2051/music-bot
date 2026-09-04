const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Shows the playback queue'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '📭 The queue is empty.', ephemeral: true });

    const songs = queue.songs
      .map((song, i) => `${i === 0 ? '🎶' : `${i}.`} ${escapeMarkdown(song.name)}`)
      .join('\n');
    await interaction.reply(`📀 **Current queue:**\n${songs}`);
  },
};
