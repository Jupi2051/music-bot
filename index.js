require('dotenv').config();

if (!process.env.TOKEN) {
  console.error('❌ Missing TOKEN environment variable. Set up the .env file (see .env.example).');
  process.exit(1);
}

// Fail-fast: without a valid yt-dlp binary, text searches keep working
// (they go through SoundCloud) but LINKS fail with confusing errors mid-session.
// Detect it on startup with an actionable message.
const { statSync } = require('fs');
const { evaluateYtDlpBinary, ytDlpBinaryPath } = require('./utils/helpers');
const ytdlpPath = ytDlpBinaryPath();
let ytdlpStat = null;
try {
  ytdlpStat = statSync(ytdlpPath);
} catch {
  // ENOENT: the verdict reports it as missing
}
const ytdlpVerdict = evaluateYtDlpBinary({ exists: ytdlpStat !== null, size: ytdlpStat?.size });
if (!ytdlpVerdict.ok) {
  console.error(ytdlpVerdict.reason);
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

// Global error handling to avoid silent crashes
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

// Load commands
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath)) {
  if (!file.endsWith('.js')) continue; // ignore non-command files (avoids crash loop)
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Load Discord events
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath)) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Instantiate DisTube with the advanced configuration
require('./config/distube')(client);

// Bot status and command updates
client.on('clientReady', async () => {
  // Set bot status
  client.user.setPresence({
    activities: [{
      name: '/help | Music for Discord',
      type: ActivityType.Listening
    }],
    status: 'online'
  });

  // Check and update commands if necessary
  await checkAndUpdateCommands();

  // Periodic command update (every 6 hours) with an anti-overlap guard: if an
  // update takes longer than 6h (slow API or a stuck request), the next run
  // is skipped instead of overlapping.
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

  // Heartbeat for the container healthcheck (writes bot-state.json every 30s)
  const writeHeartbeat = () => {
    const state = {
      lastUpdate: Date.now(),
      wsPing: client.ws.ping,
      guildCount: client.guilds.cache.size,
    };
    try {
      fs.writeFileSync(path.join(__dirname, 'bot-state.json'), JSON.stringify(state));
    } catch (err) {
      console.error('Error writing bot-state.json:', err);
    }
  };
  writeHeartbeat();
  setInterval(writeHeartbeat, 30000);
});

client.login(process.env.TOKEN).catch((err) => {
  console.error('❌ Could not connect to Discord:', err.message);
  process.exit(1);
});
