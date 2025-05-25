const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la música y sale del canal de voz'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply('❌ No hay música en reproducción.');
    queue.stop();
    await interaction.reply('🛑 Música detenida.');
  },
};
