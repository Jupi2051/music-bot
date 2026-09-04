// Automatically updates the commands whenever they change
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// Checks and updates commands if necessary
async function checkAndUpdateCommands() {
  try {
    console.log('🔍 Checking for command changes...');

    // Load the previous state file if it exists
    let previousCommandsHash = '';
    const stateFilePath = path.join(__dirname, 'commands-state.json');
    if (fs.existsSync(stateFilePath)) {
      const stateData = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      previousCommandsHash = stateData.hash;
    }

    // Load current commands
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'));

    for (const file of commandFiles) {
      if (!file.endsWith('.js')) continue;

      try {
        // Clear the cache to reload the command
        delete require.cache[require.resolve(`./commands/${file}`)];
        const command = require(`./commands/${file}`);
        if (command.data) {
          commands.push(command.data.toJSON());
        } else {
          console.warn(`⚠️ Command ${file} is missing the 'data' property.`);
        }
      } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error);
      }
    }

    // Generate a hash of the current commands
    const currentCommandsJSON = JSON.stringify(commands);
    const currentCommandsHash = require('crypto')
      .createHash('md5')
      .update(currentCommandsJSON)
      .digest('hex');

    // Save the state ONLY if there are no changes (the timestamp still
    // gets updated) or AFTER a successful deploy (see below). If the deploy
    // fails, the old hash stays in the file and the retry happens on the next startup.
    const saveState = () => fs.writeFileSync(stateFilePath, JSON.stringify({
      hash: currentCommandsHash,
      timestamp: new Date().toISOString(),
      count: commands.length
    }));

    // If there are no changes, exit
    if (previousCommandsHash === currentCommandsHash) {
      saveState();
      console.log('✅ No changes to the commands. No update needed.');
      return false;
    }

    // Update the commands on Discord
    console.log(`🔄 Command changes detected. Updating ${commands.length} commands...`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    // CLIENT_ID fallback (public by design): avoids a PUT to /applications/undefined/commands
    // when it's missing from .env, which used to fail silently and left the commands unregistered.
    const clientId = process.env.CLIENT_ID || '1376190250120122452';

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    // Save the new state ONLY after a successful deploy
    saveState();
    console.log('✅ Commands updated successfully.');
    return true;
  } catch (error) {
    console.error('❌ Error updating commands:', error);
    return false;
  }
}

// If run directly
if (require.main === module) {
  checkAndUpdateCommands();
} else {
  // Export for use in other files
  module.exports = checkAndUpdateCommands;
}
