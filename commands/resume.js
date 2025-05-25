const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reanuda la música pausada'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue || queue.playing) return interaction.reply('❌ No hay música pausada.');
    queue.resume();
    await interaction.reply('▶️ Música reanudada.');
  },
};
