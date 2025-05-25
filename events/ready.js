module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    
    console.log(`
    ╔═════════════════════════════════════════════════════════╗
    ║                                                         ║
    ║              ♪  GordoDJ v1.0.0  ♪                       ║
    ║                                                         ║
    ╠═════════════════════════════════════════════════════════╣
    ║                                                         ║
    ║  Bot conectado como: ${client.user.tag.padEnd(25, ' ')} ║
    ║  Servidores: ${String(guilds).padEnd(35, ' ')}          ║
    ║  Usuarios: ${String(users).padEnd(36, ' ')}             ║
    ║                                                         ║
    ║  https://github.com/santino-rosso/BotMusicaDiscord      ║
    ║                                                         ║
    ╚═════════════════════════════════════════════════════════╝
    `);
  },
};
