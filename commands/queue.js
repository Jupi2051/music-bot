const { SlashCommandBuilder } = require('discord.js');
const { buildQueueEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Shows the playback queue'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '📭 The queue is empty.', ephemeral: true });

    await interaction.reply({ embeds: [buildQueueEmbed(queue)] });
  },
};
