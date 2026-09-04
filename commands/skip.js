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
        // queue.skip() throws before touching anything, so the current song
        // would otherwise just keep playing. Stop it (same as /stop, minus
        // leaving the channel) so skipping the last song behaves like that
        // song ending naturally: playback stops, the bot stays connected
        // waiting for the next /play.
        try {
          await queue.stop();
          return interaction.reply("⏭️ Song skipped. That was the last one — I'll wait here, queue up more with `/play`.").catch(() => {});
        } catch (stopError) {
          console.error('Error stopping after skipping the last song:', stopError);
          return interaction.reply('❌ Could not skip the song.').catch(() => {});
        }
      }
      console.error('Error skipping:', error);
      await interaction.reply('❌ Could not skip the song.').catch(() => {});
    }
  },
};
