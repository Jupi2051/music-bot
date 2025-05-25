const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra la lista de comandos disponibles'),
  async execute(interaction) {
    const musicCommands = [
      '`/play [cancion]` - Reproduce una canción o playlist',
      '`/stop` - Detiene la música y el bot sale del canal de voz',
      '`/skip` - Salta a la siguiente canción',
      '`/pause` - Pausa la canción actual',
      '`/resume` - Reanuda la canción pausada',
      '`/queue` - Muestra la lista de canciones en cola',
      '`/volume [1-100]` - Cambia el volumen del bot'
    ].join('\n');
    
    const utilityCommands = [
      '`/help` - Muestra esta lista de comandos',
      '`/ping` - Comprueba la latencia del bot',
      '`/stats` - Muestra estadísticas del bot'
    ].join('\n');

    await interaction.reply({ 
      content: `🎵 **Comandos de música:**\n${musicCommands}\n\n🔧 **Utilidades:**\n${utilityCommands}`, 
      flags: 64 
    });
  }
};
