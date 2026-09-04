const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pauses the current song'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || !queue.playing) {
      return interaction.reply({ content: '❌ No music is playing.', ephemeral: true });
    }

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      await queue.pause();
    } catch (error) {
      console.error('Error pausing:', error);
      return interaction.reply('❌ Could not pause the music.');
    }
    await interaction.reply('⏸️ Music paused.');
  },
};
