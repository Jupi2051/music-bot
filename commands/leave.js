const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Makes the bot leave the voice channel'),
  async execute(interaction, client) {
    const connection = client.distube.voices.get(interaction.guild.id);
    if (!connection) return interaction.reply({ content: '❌ The bot is not in a voice channel.', ephemeral: true });

    const controlError = assertControl(interaction, connection.channel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      connection.leave();
      await interaction.reply('👋 The bot has left the voice channel.');
    } catch (error) {
      console.error('Error leaving the channel:', error);
      await interaction.reply('❌ Could not leave the voice channel.').catch(() => {});
    }
  },
};
