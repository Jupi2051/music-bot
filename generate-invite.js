require('dotenv').config();
const CLIENT_ID = process.env.CLIENT_ID || '1376190250120122452';

// Permisos necesarios para el bot de música (slash commands van por el scope
// applications.commands, no por el permiso):
// 1024     = Ver canales
// 2048     = Enviar mensajes
// 16384    = Insertar enlaces
// 65536    = Leer historial de mensajes
// 1048576  = Conectar a voz
// 2097152  = Hablar
const PERMISSIONS = '1024+2048+16384+65536+1048576+2097152';

// Crear URL de invitación
const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${PERMISSIONS}&scope=bot%20applications.commands`;

console.log('='.repeat(50));
console.log('🎵 GordoDJ - Enlace de invitación del bot');
console.log('='.repeat(50));
console.log(`\n${inviteUrl}\n`);
console.log('='.repeat(50));
console.log('Comparte este enlace para invitar al bot a otros servidores');
console.log('='.repeat(50));
