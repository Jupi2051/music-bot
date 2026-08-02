const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta el volumen (1-100)')
    .addIntegerOption(option =>
      option.setName('porcentaje')
        .setDescription('Volumen deseado')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const volume = interaction.options.getInteger('porcentaje');
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '❌ No hay música reproduciéndose.', ephemeral: true });

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    queue.setVolume(volume);
    await interaction.reply(`🔊 Volumen ajustado a ${volume}%`);
  },
};
