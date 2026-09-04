const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const { MAX_QUEUE_SIZE, checkCooldown, cleanQuery, getQueryError, isPlaylistUrl } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Plays a song or playlist')
    .addStringOption(option =>
      option.setName('song')
        .setDescription('Name or URL')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const query = cleanQuery(interaction.options.getString('song'));
    // Anti-RCE hardening: block queries that start with "-" (yt-dlp flag
    // injection) or use non-http(s) protocols (LFI via file://).
    const queryError = getQueryError(query);
    if (queryError) return interaction.reply({ content: queryError, ephemeral: true });
    const voiceChannel = interaction.member?.voice?.channel;
    // `interaction.member` is null in DMs; give a clear message instead of a TypeError
    if (!interaction.member) return interaction.reply({ content: '❌ This command only works in servers.', ephemeral: true });
    if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });

    const key = `${interaction.guildId}:${interaction.user.id}`;
    if (checkCooldown(key, 5000)) {
      return interaction.reply({ content: '⏳ Wait a few seconds before requesting another song.', ephemeral: true });
    }

    const queue = client.distube.getQueue(interaction);
    if (queue && queue.songs.length >= MAX_QUEUE_SIZE) {
      return interaction.reply({ content: `❌ The queue is full (max ${MAX_QUEUE_SIZE} songs).`, ephemeral: true });
    }

    // Playlists/albums take time to resolve song by song (yt-dlp extracts
    // sequentially; measured: ~1.5s per song). Show "loading playlist" instead
    // of the generic "searching" so the resolution wait doesn't look like a hang.
    const isPlaylist = isPlaylistUrl(query);
    await interaction.reply(
      isPlaylist
        ? `📃 Loading playlist: \`${escapeMarkdown(query)}\`. This takes a few seconds...`
        : `🔍 Searching: \`${escapeMarkdown(query)}\``
    );
    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: interaction.member,
      });
    } catch (error) {
      console.error('Error playing:', error);
      await interaction
        .editReply('❌ Could not play. Try another name or URL.')
        .catch(() => {});
    }
  },
};
