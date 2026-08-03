const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { escapeMarkdown } = require('discord.js');
const { MAX_QUEUE_SIZE } = require('../utils/helpers');

module.exports = (client) => {
  const distube = new DisTube(client, {
    emitNewSongOnly: true,
    nsfw: false, // No permitir contenido para adultos
    plugins: [
      // Spotify: con SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET en .env usa la API
      // oficial (playlists/álbumes completos). Sin credenciales funciona a
      // medias (solo metadata básica y puede fallar en listas largas).
      new SpotifyPlugin({
        api: {
          clientId: process.env.SPOTIFY_CLIENT_ID,
          clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        },
      }),
      new SoundCloudPlugin(),
      new YtDlpPlugin()
    ],
  });

  // Guardamos la instancia para que esté disponible en client
  client.distube = distube;

  // Eventos de distube
  const sendToChannel = (channel, message) => {
    if (!channel) return;
    channel.send(message).catch(err => console.error('Error al enviar mensaje al canal:', err));
  };

  distube
    .on('playSong', (queue, song) => {
      sendToChannel(queue?.textChannel, `🎵 Reproduciendo: **${escapeMarkdown(song.name)}** [\`${song.formattedDuration}\`]`);
    })
    .on('addSong', (queue, song) => {
      if (queue.songs.length > MAX_QUEUE_SIZE) {
        queue.songs.splice(MAX_QUEUE_SIZE);
        sendToChannel(queue?.textChannel, `⚠️ Cola llena (máximo ${MAX_QUEUE_SIZE} canciones). No se agregó: **${escapeMarkdown(song.name)}**`);
        return;
      }
      sendToChannel(queue?.textChannel, `➕ Añadido: **${escapeMarkdown(song.name)}**`);
    })
    .on('addList', (queue, playlist) => {
      if (queue.songs.length > MAX_QUEUE_SIZE) {
        const removed = queue.songs.length - MAX_QUEUE_SIZE;
        queue.songs.splice(MAX_QUEUE_SIZE);
        sendToChannel(queue?.textChannel, `📃 Lista añadida: **${escapeMarkdown(playlist.name)}** — se recortaron ${removed} canciones (máximo ${MAX_QUEUE_SIZE}).`);
        return;
      }
      sendToChannel(queue?.textChannel, `📃 Lista añadida: **${escapeMarkdown(playlist.name)}** con ${playlist.songs.length} canciones.`);
    })
    .on('error', (error, queue) => {
      console.error('Error de reproducción:', error);
      sendToChannel(queue?.textChannel, '❌ Error al reproducir música.');
    })
    .on('finish', queue => sendToChannel(queue?.textChannel, '✅ Reproducción terminada.'))
    .on('empty', queue => sendToChannel(queue?.textChannel, '📭 Canal de voz vacío, saliendo...'))
    .on('disconnect', queue => sendToChannel(queue?.textChannel, '👋 Me desconecté del canal.'));
};
