const { SlashCommandBuilder } = require('discord.js');
const { assertControl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skips to the next song'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply({ content: '❌ No music is playing.', ephemeral: true });

    const controlError = assertControl(interaction, queue.voiceChannel?.id);
    if (controlError) return interaction.reply({ content: controlError, ephemeral: true });

    try {
      await queue.skip();
      await interaction.reply('⏭️ Song skipped.');
    } catch (error) {
      // Distinguish "no next song" (expected, DisTubeError NO_UP_NEXT) from
      // genuine errors (network, voice) that deserve a real message, not a misleading one.
      if (error?.errorCode === 'NO_UP_NEXT' || error?.errorCode === 'NO_SONG_POSITION') {
        return interaction.reply('⚠️ No more songs to skip.').catch(() => {});
      }
      console.error('Error skipping:', error);
      await interaction.reply('❌ Could not skip the song.').catch(() => {});
    }
  },
};
