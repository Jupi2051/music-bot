const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows the list of available commands'),
  async execute(interaction) {
    const musicCommands = [
      '`/play [song]` - Plays a song or playlist',
      '`/stop` - Stops the music and the bot leaves the voice channel',
      '`/skip` - Skips to the next song',
      '`/pause` - Pauses the current song',
      '`/resume` - Resumes the paused song',
      '`/queue` - Shows the songs in the queue',
      '`/nowplaying` - Shows the song currently playing',
      '`/volume [1-100]` - Changes the bot volume',
      '`/set [time]` - Changes the playback position (e.g. 3:20)',
      '`/leave` - Makes the bot leave the voice channel',
      '`/help` - Shows this list'
    ].join('\n');

    await interaction.reply({
      content: `🎵 **Available commands:**\n${musicCommands}`,
      flags: 64
    });
  }
};
