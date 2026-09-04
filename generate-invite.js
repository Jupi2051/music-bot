require('dotenv').config();

// In open source, everyone runs their own application: CLIENT_ID is required
// (it's in .env). Without it there's no way to build a valid link.
if (!process.env.CLIENT_ID) {
  console.error('❌ Missing CLIENT_ID in .env. Set up your own Discord app (see README).');
  process.exit(1);
}
const CLIENT_ID = process.env.CLIENT_ID;

// Permissions the music bot needs (slash commands go through the
// applications.commands scope, not a permission):
// 1024     = View Channels
// 2048     = Send Messages
// 16384    = Embed Links
// 65536    = Read Message History
// 1048576  = Connect
// 2097152  = Speak
const PERMISSIONS = '1024+2048+16384+65536+1048576+2097152';

// Build invite URL
const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${PERMISSIONS}&scope=bot%20applications.commands`;

console.log('='.repeat(50));
console.log('🎵 GordoDJ - Bot invite link');
console.log('='.repeat(50));
console.log(`\n${inviteUrl}\n`);
console.log('='.repeat(50));
console.log('Share this link to invite the bot to other servers');
console.log('='.repeat(50));
