const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Hace que el bot salga del canal de voz'),
  async execute(interaction, client) {
    const connection = client.distube.voices.get(interaction.guild.id);
    
    if (!connection) {
      return interaction.reply('❌ El bot no está en un canal de voz.');
    }

    try {
      connection.leave();
      await interaction.reply('👋 El bot ha salido del canal de voz.');
    } catch (error) {
      console.error('Error al salir del canal:', error);
      await interaction.reply('❌ No se pudo salir del canal de voz.');
    }
  },
};
