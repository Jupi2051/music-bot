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
  distube
    .on('playSong', (queue, song) => {
      queue.textChannel.send(`🎵 Reproduciendo: **${song.name}** [\`${song.formattedDuration}\`]`);
    })
    .on('addSong', (queue, song) => {
      queue.textChannel.send(`➕ Añadido: **${song.name}**`);
    })
    .on('addList', (queue, playlist) => {
      queue.textChannel.send(`📃 Lista añadida: **${playlist.name}** con ${playlist.songs.length} canciones.`);
    })
    .on('error', (channel, error) => {
      console.error(error);
      channel.send('❌ Error al reproducir música.');
    })
    .on('finish', queue => queue.textChannel.send('✅ Reproducción terminada.'))
    .on('empty', queue => queue.textChannel.send('📭 Canal de voz vacío, saliendo...'))
    .on('disconnect', queue => queue.textChannel.send('👋 Me desconecté del canal.'))
    .on('searchNoResult', (message, query) => {
      message.channel.send(`❌ No se encontraron resultados para \`${query}\``);
    });
};
