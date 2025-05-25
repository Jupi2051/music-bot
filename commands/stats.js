const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { version } = require('../package.json');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Muestra las estadísticas del bot'),
  async execute(interaction, client) {
    // Calcular tiempo de actividad
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    
    // Calcular uso de memoria
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
    const totalMemoryMB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    
    // Estadísticas de música
    const totalGuilds = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const totalChannels = client.channels.cache.size;
    const totalActiveQueues = client.distube.queues.collection.size;
    const totalCommands = client.commands.size;
    
    // Crear embed
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('📊 Estadísticas de GordoDJ')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🤖 Versión', value: `v${version}`, inline: true },
        { name: '⏰ Uptime', value: uptimeStr, inline: true },
        { name: '💿 Memoria', value: `${memoryUsedMB}MB / ${totalMemoryMB}GB`, inline: true },
        { name: '🏢 Servidores', value: totalGuilds.toString(), inline: true },
        { name: '👥 Usuarios', value: totalMembers.toString(), inline: true },
        { name: '📝 Comandos', value: totalCommands.toString(), inline: true },
        { name: '🎵 Colas activas', value: totalActiveQueues.toString(), inline: true },
        { name: '📡 Latencia API', value: `${client.ws.ping}ms`, inline: true },
        { name: '🖥️ Plataforma', value: `${os.platform()} ${os.arch()}`, inline: true },
      )
      .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
};
