const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o playlist')
    .addStringOption(option =>
      option.setName('cancion')
        .setDescription('Nombre o URL')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const query = interaction.options.getString('cancion');
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.reply('❌ Debes estar en un canal de voz.');

    await interaction.reply(`🔍 Buscando: \`${query}\``);
    
    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: interaction.member,
      });
    } catch (error) {
      console.error('Error al reproducir:', error);
      await interaction.editReply(`❌ Error: ${error.message || 'No se pudo reproducir la canción'}`);
    }
  }
};

