const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene la música y hace que el bot salga del canal de voz'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction.guild);

    if (!queue) {
      return interaction.reply({ content: '❌ No hay música en reproducción.', ephemeral: true });
    }

    try {
      await queue.stop(); // Esto también desconecta del canal si no hay más música

      // Por si no se desconecta automáticamente:
      const connection = client.distube.voices.get(interaction.guild.id);
      if (connection) {
        connection.leave(); 
      }

      await interaction.reply('🛑 Música detenida y bot desconectado del canal de voz.');
    } catch (error) {
      console.error('Error al detener la música y salir del canal:', error);
      await interaction.reply('❌ Hubo un error al detener la música.');
    }
  },
};
