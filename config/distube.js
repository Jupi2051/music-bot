const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');

module.exports = (client) => {
  const distube = new DisTube(client, {
    emitNewSongOnly: true,
    nsfw: false, // No permitir contenido para adultos
    plugins: [
      new SpotifyPlugin(),
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
      sendToChannel(queue?.textChannel, `🎵 Reproduciendo: **${song.name}** [\`${song.formattedDuration}\`]`);
    })
    .on('addSong', (queue, song) => {
      sendToChannel(queue?.textChannel, `➕ Añadido: **${song.name}**`);
    })
    .on('addList', (queue, playlist) => {
      sendToChannel(queue?.textChannel, `📃 Lista añadida: **${playlist.name}** con ${playlist.songs.length} canciones.`);
    })
    .on('error', (error, queue) => {
      console.error('Error de reproducción:', error);
      sendToChannel(queue?.textChannel, '❌ Error al reproducir música.');
    })
    .on('finish', queue => sendToChannel(queue?.textChannel, '✅ Reproducción terminada.'))
    .on('empty', queue => sendToChannel(queue?.textChannel, '📭 Canal de voz vacío, saliendo...'))
    .on('disconnect', queue => sendToChannel(queue?.textChannel, '👋 Me desconecté del canal.'))
    .on('searchNoResult', (message, query) => {
      sendToChannel(message?.channel, `❌ No se encontraron resultados para \`${query}\``);
    });
};
