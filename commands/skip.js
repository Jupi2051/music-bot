const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta a la siguiente canción'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '❌ No hay música reproduciéndose.', ephemeral: true });

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      await queue.skip();
      await interaction.reply('⏭️ Canción saltada.');
    } catch (error) {
      // Distinguir "no hay siguiente" (esperado, DisTubeError NO_UP_NEXT) de
      // errores genuinos (red, voz) que merecen un mensaje real, no uno engañoso.
      if (error?.errorCode === 'NO_UP_NEXT' || error?.errorCode === 'NO_SONG_POSITION') {
        return interaction.reply('⚠️ No hay más canciones para saltar.').catch(() => {});
      }
      console.error('Error al saltar:', error);
      await interaction.reply('❌ No se pudo saltar la canción.').catch(() => {});
    }
  },
};
