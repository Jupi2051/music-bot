const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la canción actual'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || !queue.playing) return interaction.reply('❌ No hay música reproduciéndose.');
    queue.pause();
    await interaction.reply('⏸️ Música pausada.');
  },
};
