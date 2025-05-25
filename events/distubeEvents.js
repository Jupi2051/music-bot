module.exports = (client) => {
  const distube = client.distube;

  distube
    .on('playSong', (queue, song) =>
      queue.textChannel.send(`🎵 Reproduciendo: **${song.name}**`)
    )
    .on('addSong', (queue, song) =>
      queue.textChannel.send(`➕ Añadida a la cola: **${song.name}**`)
    )
    .on('error', (channel, error) => {
      console.error(error);
      if (channel) channel.send('❌ Ocurrió un error al reproducir.');
    });
};
