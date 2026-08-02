require('dotenv').config();

if (!process.env.TOKEN) {
  console.error('❌ Falta la variable de entorno TOKEN. Configurá el archivo .env (ver .env.example).');
  process.exit(1);
}

const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const fs = require('fs');
const path = require('path');
const checkAndUpdateCommands = require('./update-commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

// Manejo global de errores para evitar crashes silenciosos
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1); // PM2/Docker reinician el proceso
});

client.on('error', (err) => {
  console.error('Error del cliente Discord:', err);
});

// Cargar comandos
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
  if (!file.endsWith('.js')) continue; // ignorar archivos no-comando (evita crash loop)
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
client.on('clientReady', async () => {
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

  // Actualización periódica de comandos (cada 6 horas) con guard
  // anti-solapamiento: si una actualización tarda más de 6h (API lenta o
  // bloqueo), la siguiente ejecución se saltea en vez de pisarse.
  let isUpdating = false;
  setInterval(async () => {
    if (isUpdating) return;
    isUpdating = true;
    try {
      await checkAndUpdateCommands();
    } finally {
      isUpdating = false;
    }
  }, 6 * 60 * 60 * 1000);

  // Heartbeat para el healthcheck del contenedor (escribe bot-state.json cada 30s)
  const writeHeartbeat = () => {
    const state = {
      lastUpdate: Date.now(),
      wsPing: client.ws.ping,
      guildCount: client.guilds.cache.size,
    };
    try {
      fs.writeFileSync(path.join(__dirname, 'bot-state.json'), JSON.stringify(state));
    } catch (err) {
      console.error('Error al escribir bot-state.json:', err);
    }
  };
  writeHeartbeat();
  setInterval(writeHeartbeat, 30000);
});

client.login(process.env.TOKEN).catch((err) => {
  console.error('❌ No se pudo conectar con Discord:', err.message);
  process.exit(1);
});
