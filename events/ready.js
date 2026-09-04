module.exports = {
  name: 'clientReady',
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
    ║  Bot connected as: ${client.user.tag.padEnd(36, ' ')} ║
    ║  Servers: ${String(guilds).padEnd(45, ' ')} ║
    ║  Users: ${String(users).padEnd(47, ' ')} ║
    ║                                                         ║
    ║  https://github.com/santino-rosso/BotMusicaDiscord      ║
    ║                                                         ║
    ╚═════════════════════════════════════════════════════════╝
    `);
  },
};
