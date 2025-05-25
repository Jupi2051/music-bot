// Este script reinicia el bot automáticamente si se cae
const { exec } = require('child_process');
const fs = require('fs');

// Crear archivo de log
const logStream = fs.createWriteStream('./bot-restart.log', { flags: 'a' });

// Función para registrar en el log
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
  console.log(message);
}

// Función para iniciar el bot
function startBot() {
  log('Iniciando el bot...');
  
  const botProcess = exec('node index.js');
  
  botProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  botProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  botProcess.on('close', (code) => {
    log(`El bot se ha cerrado con código ${code}. Reiniciando en 10 segundos...`);
    setTimeout(startBot, 10000);
  });
  
  // Manejar señales del sistema
  process.on('SIGINT', () => {
    log('Recibida señal SIGINT. Deteniendo el bot...');
    botProcess.kill();
    process.exit(0);
  });
}

// Iniciar el bot
startBot();
