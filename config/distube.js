const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { escapeMarkdown } = require('discord.js');
const { MAX_QUEUE_SIZE } = require('../utils/helpers');
const { buildNowPlayingEmbed, buildAddedToQueueEmbed } = require('../utils/embeds');

module.exports = (client) => {
  const distube = new DisTube(client, {
    emitNewSongOnly: true,
    nsfw: false, // Do not allow adult content
    plugins: [
      // Spotify: with SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET in .env it uses
      // the official API (full playlists/albums). Without credentials it
      // works partially (basic metadata only and may fail on long lists).
      new SpotifyPlugin({
        api: {
          clientId: process.env.SPOTIFY_CLIENT_ID,
          clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        },
      }),
      new SoundCloudPlugin(),
      // update:false: the yt-dlp binary is downloaded at Dockerfile build
      // time (or already exists locally). Runtime auto-update allowed the
      // binary to be overwritten (persistent RCE risk).
      new YtDlpPlugin({ update: false })
    ],
  });

  // Store the instance so it's available on client
  client.distube = distube;

  // DisTube events
  const sendToChannel = (channel, message) => {
    if (!channel) return;
    channel.send(message).catch(err => console.error('Error sending message to channel:', err));
  };

  distube
    .on('playSong', (queue, song) => {
      sendToChannel(queue?.textChannel, { embeds: [buildNowPlayingEmbed(song, { volume: queue?.volume })] });
    })
    .on('addSong', (queue, song) => {
      if (queue.songs.length > MAX_QUEUE_SIZE) {
        queue.songs.splice(MAX_QUEUE_SIZE);
        sendToChannel(queue?.textChannel, `⚠️ Queue full (max ${MAX_QUEUE_SIZE} songs). Not added: **${escapeMarkdown(song.name)}**`);
        return;
      }
      const position = queue.songs.indexOf(song) + 1;
      sendToChannel(queue?.textChannel, { embeds: [buildAddedToQueueEmbed(song, { position: position > 0 ? position : undefined })] });
    })
    .on('addList', (queue, playlist) => {
      if (queue.songs.length > MAX_QUEUE_SIZE) {
        const removed = queue.songs.length - MAX_QUEUE_SIZE;
        queue.songs.splice(MAX_QUEUE_SIZE);
        sendToChannel(queue?.textChannel, `📃 Playlist added: **${escapeMarkdown(playlist.name)}** — trimmed ${removed} songs (max ${MAX_QUEUE_SIZE}).`);
        return;
      }
      sendToChannel(queue?.textChannel, `📃 Playlist added: **${escapeMarkdown(playlist.name)}** with ${playlist.songs.length} songs.`);
    })
    .on('error', (error, queue) => {
      console.error('Playback error:', error);
      sendToChannel(queue?.textChannel, '❌ Error playing music.');
    })
    .on('finish', queue => sendToChannel(queue?.textChannel, '✅ Playback finished.'))
    .on('empty', queue => sendToChannel(queue?.textChannel, '📭 Voice channel empty, leaving...'))
    .on('disconnect', queue => sendToChannel(queue?.textChannel, '👋 Disconnected from the channel.'));
};
