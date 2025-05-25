const { SlashCommandBuilder } = require('discord.js');

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
    if (!queue) return interaction.reply('❌ No hay música en reproducción.');
    queue.setVolume(volume);
    await interaction.reply(`🔊 Volumen ajustado a ${volume}%`);
  },
};
