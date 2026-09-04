const { SlashCommandBuilder } = require('discord.js');
const { buildNowPlayingEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Shows the song currently playing'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || !queue.songs.length) {
      return interaction.reply({ content: '❌ No music is playing.', ephemeral: true });
    }

    await interaction.reply({ embeds: [buildNowPlayingEmbed(queue.songs[0], { volume: queue.volume })] });
  },
};
