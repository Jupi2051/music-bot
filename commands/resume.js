const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reanuda la música pausada'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || queue.playing) {
      return interaction.reply({ content: '❌ No hay música pausada.', ephemeral: true });
    }

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      await queue.resume();
    } catch (error) {
      console.error('Error al reanudar:', error);
      return interaction.reply('❌ No se pudo reanudar la música.');
    }
    await interaction.reply('▶️ Música reanudada.');
  },
};
