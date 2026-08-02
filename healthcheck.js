// Healthcheck: verifica que el bot esté vivo a través del heartbeat en bot-state.json
const fs = require('fs');
const path = require('path');

const MAX_AGE_MS = 90 * 1000; // el heartbeat se escribe cada 30s; 90s = 3 intervalos perdidos

try {
  const stateFile = path.join(__dirname, 'bot-state.json');
  if (!fs.existsSync(stateFile)) {
    console.log('Health check failed: bot-state.json no existe (el bot aún no escribió heartbeat)');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const age = Date.now() - state.lastUpdate;
  if (age > MAX_AGE_MS) {
    console.log(`Health check failed: heartbeat vencido (${Math.round(age / 1000)}s)`);
    process.exit(1);
  }

  console.log(`Health check passed (heartbeat ${Math.round(age / 1000)}s, ping ${state.wsPing}ms, ${state.guildCount} guilds)`);
  process.exit(0);
} catch (error) {
  console.log('Health check failed:', error.message);
  process.exit(1);
}
