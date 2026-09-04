const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Adjusts the volume (1-100)')
    .addIntegerOption(option =>
      option.setName('percentage')
        .setDescription('Desired volume')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const volume = interaction.options.getInteger('percentage');
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '❌ No music is playing.', ephemeral: true });

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    queue.setVolume(volume);
    await interaction.reply(`🔊 Volume set to ${volume}%`);
  },
};
