const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Muestra información sobre la canción actual'),
  async execute(interaction, client) {
    const queue = client.distube.getQueue(interaction);
    if (!queue) return interaction.reply('❌ No hay música reproduciéndose actualmente.');
    
    const song = queue.songs[0];
    const currentTime = queue.currentTime;
    const duration = song.duration;
    
    // Crear barra de progreso
    const progressBar = createProgressBar(currentTime, duration);
    
    // Formatear tiempo actual y duración
    const formattedCurrentTime = formatTime(currentTime);
    const formattedDuration = formatTime(duration);
    
    const embed = new EmbedBuilder()
      .setTitle('🎵 Reproduciendo ahora')
      .setDescription(`**[${song.name}](${song.url})**`)
      .setThumbnail(song.thumbnail)
      .addFields(
        { name: 'Canal', value: song.uploader.name || 'Desconocido', inline: true },
        { name: 'Duración', value: song.formattedDuration, inline: true },
        { name: 'Solicitado por', value: `<@${song.user.id}>`, inline: true },
        { name: 'Progreso', value: `${progressBar}\n\`${formattedCurrentTime} / ${formattedDuration}\``, inline: false }
      )
      .setColor('#FFA500')
      .setFooter({ text: `Volumen: ${queue.volume}% | Filtros: ${queue.filters.names.join(', ') || 'Ninguno'}` });
    
    await interaction.reply({ embeds: [embed] });
  }
};

// Función para crear barra de progreso
function createProgressBar(currentTime, duration) {
  const percentage = currentTime / duration;
  const progress = Math.round(15 * percentage);
  const emptyProgress = 15 - progress;
  
  const progressText = '▇'.repeat(progress);
  const emptyProgressText = '—'.repeat(emptyProgress);
  
  return `${progressText}${emptyProgressText}`;
}

// Función para formatear tiempo
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}
