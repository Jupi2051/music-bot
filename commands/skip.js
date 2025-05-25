const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta a la siguiente canción'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply('❌ No hay música en reproducción.');
    try {
      await queue.skip();
      await interaction.reply('⏭️ Canción saltada.');
    } catch (error) {
      console.error(error);
      await interaction.reply('⚠️ No hay más canciones para saltar.');
    }
  },
};
