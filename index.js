require('dotenv').config();
const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const fs = require('fs');
const path = require('path');
const checkAndUpdateCommands = require('./update-commands');
const keepAlive = require('./server'); // Importar el servidor web

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

// Cargar comandos
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Cargar eventos de Discord
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath)) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Instanciar DisTube con la configuración avanzada
require('./config/distube')(client);

// Estado del bot y actualización de comandos
client.on('ready', async () => {
  // Establecer estado del bot
  client.user.setPresence({
    activities: [{ 
      name: '/help | Música para Discord', 
      type: ActivityType.Listening 
    }],
    status: 'online'
  });
  
  // Verificar y actualizar comandos si es necesario
  await checkAndUpdateCommands();
  
  // Configurar actualización periódica de comandos (cada 6 horas)
  setInterval(async () => {
    await checkAndUpdateCommands();
  }, 6 * 60 * 60 * 1000);
});

// Iniciar el servidor web para mantener el bot activo en Replit
keepAlive();

client.login(process.env.TOKEN);
