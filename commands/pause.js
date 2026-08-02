const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la canción actual'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || !queue.playing) {
      return interaction.reply({ content: '❌ No hay música reproduciéndose.', ephemeral: true });
    }

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      await queue.pause();
    } catch (error) {
      console.error('Error al pausar:', error);
      return interaction.reply('❌ No se pudo pausar la música.');
    }
    await interaction.reply('⏸️ Música pausada.');
  },
};
