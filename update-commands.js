// Archivo para actualizar los comandos automáticamente en caso de cambios
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// Función para verificar y actualizar comandos si es necesario
async function checkAndUpdateCommands() {
  try {
    console.log('🔍 Verificando cambios en los comandos...');
    
    // Cargar el archivo de estado anterior si existe
    let previousCommandsHash = '';
    const stateFilePath = path.join(__dirname, 'commands-state.json');
    if (fs.existsSync(stateFilePath)) {
      const stateData = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      previousCommandsHash = stateData.hash;
    }
    
    // Cargar comandos actuales
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'));
    
    for (const file of commandFiles) {
      if (!file.endsWith('.js')) continue;
      
      try {
        // Eliminar caché para recargar el comando
        delete require.cache[require.resolve(`./commands/${file}`)];
        const command = require(`./commands/${file}`);
        if (command.data) {
          commands.push(command.data.toJSON());
        } else {
          console.warn(`⚠️ El comando ${file} no tiene la propiedad 'data'.`);
        }
      } catch (error) {
        console.error(`❌ Error al cargar el comando ${file}:`, error);
      }
    }
    
    // Generar hash de los comandos actuales
    const currentCommandsJSON = JSON.stringify(commands);
    const currentCommandsHash = require('crypto')
      .createHash('md5')
      .update(currentCommandsJSON)
      .digest('hex');
    
    // Guardar el nuevo estado
    fs.writeFileSync(stateFilePath, JSON.stringify({ 
      hash: currentCommandsHash,
      timestamp: new Date().toISOString(),
      count: commands.length
    }));
    
    // Si no hay cambios, salir
    if (previousCommandsHash === currentCommandsHash) {
      console.log('✅ No hay cambios en los comandos. No es necesario actualizar.');
      return false;
    }
    
    // Actualizar los comandos en Discord
    console.log(`🔄 Se detectaron cambios en los comandos. Actualizando ${commands.length} comandos...`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    console.log('✅ Comandos actualizados exitosamente.');
    return true;
  } catch (error) {
    console.error('❌ Error al actualizar los comandos:', error);
    return false;
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  checkAndUpdateCommands();
} else {
  // Exportar para uso en otros archivos
  module.exports = checkAndUpdateCommands;
}
