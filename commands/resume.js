const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resumes the paused music'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || queue.playing) {
      return interaction.reply({ content: '❌ No music is paused.', ephemeral: true });
    }

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      await queue.resume();
    } catch (error) {
      console.error('Error resuming:', error);
      return interaction.reply('❌ Could not resume the music.');
    }
    await interaction.reply('▶️ Music resumed.');
  },
};
