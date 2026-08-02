const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la canción actual'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || !queue.playing) return interaction.reply('❌ No hay música reproduciéndose.');

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply(controlError);

    queue.pause();
    await interaction.reply('⏸️ Música pausada.');
  },
};
