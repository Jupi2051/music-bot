const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reanuda la música pausada'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || queue.playing) return interaction.reply('❌ No hay música pausada.');

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply(controlError);

    queue.resume();
    await interaction.reply('▶️ Música reanudada.');
  },
};
