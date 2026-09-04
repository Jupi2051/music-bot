const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stops the music and makes the bot leave the voice channel'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '❌ No music is playing.', ephemeral: true });

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      await queue.stop();
      const connection = client.distube.voices.get(interaction.guild.id);
      if (connection) connection.leave();
      await interaction.reply('🛑 Music stopped and bot disconnected from the voice channel.');
    } catch (error) {
      console.error('Error stopping the music:', error);
      await interaction.reply('❌ There was an error stopping the music.').catch(() => {});
    }
  },
};
