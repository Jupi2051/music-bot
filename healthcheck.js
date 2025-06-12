// Simple healthcheck que verifica si el proceso está funcionando
const fs = require('fs');
const path = require('path');

try {
  // Verificar que el archivo principal existe
  if (!fs.existsSync(path.join(__dirname, 'index.js'))) {
    console.log('Health check failed: index.js not found');
    process.exit(1);
  }

  // Verificar que node_modules existe
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log('Health check failed: node_modules not found');
    process.exit(1);
  }

  // Si hay un archivo de estado del bot, verificarlo
  const stateFile = path.join(__dirname, 'bot-state.json');
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const lastUpdate = new Date(state.lastUpdate);
    const now = new Date();
    const diffMinutes = (now - lastUpdate) / (1000 * 60);
    
    // Si el estado no se ha actualizado en más de 5 minutos, fallar
    if (diffMinutes > 5) {
      console.log('Health check failed: Bot state is stale');
      process.exit(1);
    }
  }

  console.log('Health check passed');
  process.exit(0);
} catch (error) {
  console.log('Health check failed:', error.message);
  process.exit(1);
}
