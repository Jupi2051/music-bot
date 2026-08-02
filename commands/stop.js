const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la música y hace que el bot salga del canal de voz'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '❌ No hay música en reproducción.', ephemeral: true });

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply(controlError);

    try {
      await queue.stop();
      const connection = client.distube.voices.get(interaction.guild.id);
      if (connection) connection.leave();
      await interaction.reply('🛑 Música detenida y bot desconectado del canal de voz.');
    } catch (error) {
      console.error('Error al detener la música:', error);
      await interaction.reply('❌ Hubo un error al detener la música.').catch(() => {});
    }
  },
};
