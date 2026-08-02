const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta a la siguiente canción'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply('❌ No hay música en reproducción.');

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply(controlError);

    try {
      await queue.skip();
      await interaction.reply('⏭️ Canción saltada.');
    } catch (error) {
      console.error('Error al saltar:', error);
      await interaction.reply('⚠️ No hay más canciones para saltar.').catch(() => {});
    }
  },
};
