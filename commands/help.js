const { SlashCommandBuilder } = require('discord.js');
const { ALIASES, getPrefix } = require('../utils/textCommands');

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

    const prefix = getPrefix();
    const example = ALIASES.play?.[0] || 'play';
    const textCommandsHint = `Text commands also work: type \`${prefix}\` followed by a command name or alias (case-insensitive), e.g. \`${prefix}play\` or \`${prefix}${example}\`.`;

    await interaction.reply({
      content: `🎵 **Available commands:**\n${musicCommands}\n\n${textCommandsHint}`,
      flags: 64
    });
  }
};
