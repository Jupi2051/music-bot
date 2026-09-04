const { handleTextCommand } = require('../utils/textCommands');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    await handleTextCommand(message, client);
  },
};
