# GordoDJ - Bot de Música para Discord

Un bot de música para Discord que te permite reproducir música de YouTube, Spotify, SoundCloud y más directamente en tus canales de voz.

## Invitar al Bot

Para añadir GordoDJ a tu servidor, haz clic en el siguiente enlace:

[**Invitar GordoDJ a tu servidor**](https://discord.com/api/oauth2/authorize?client_id=1376190250120122452&permissions=3145728+2048+16384+65536+2097152+1048576+2097152+4194304&scope=bot%20applications.commands)

## Características

- Reproducción de música desde múltiples fuentes (YouTube, Spotify, SoundCloud)
- Comandos de control de reproducción (play, pause, resume, skip, stop)
- Control de volumen
- Cola de reproducción
- Soporte para playlists

## Comandos

- `/play [cancion]` - Reproduce una canción o playlist
- `/stop` - Detiene la música y el bot sale del canal de voz
- `/skip` - Salta a la siguiente canción
- `/pause` - Pausa la canción actual
- `/resume` - Reanuda la canción pausada
- `/queue` - Muestra la lista de canciones en cola
- `/volume [1-100]` - Cambia el volumen del bot
- `/help` - Muestra la lista de comandos disponibles

## Requisitos

- Node.js v16.9.0 o superior
- FFmpeg instalado en el sistema
- Token de bot de Discord
- ID de aplicación de Discord

## Instalación

1. Clona este repositorio:
   ```
   git clone https://github.com/tuusuario/gordodj.git
   cd gordodj
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:
   ```
   TOKEN=tu_token_de_discord
   CLIENT_ID=tu_id_de_aplicacion
   ```

4. Registra los comandos slash:
   ```
   node deploy-commands.js
   ```

5. Inicia el bot:
   ```
   node index.js
   ```

Para opciones avanzadas de hosting, consulta [HOSTING.md](HOSTING.md).

## Configuración en Discord Developer Portal

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación o selecciona una existente
3. Ve a la sección "Bot" y activa los siguientes Intents:
   - MESSAGE CONTENT INTENT
   - SERVER MEMBERS INTENT
   - PRESENCE INTENT
4. Genera un token de bot y guárdalo en tu archivo `.env`
5. Ve a OAuth2 > URL Generator, selecciona los scopes "bot" y "applications.commands"
6. Selecciona los permisos necesarios (al menos "Send Messages", "Connect", "Speak")
7. Usa la URL generada para invitar al bot a tus servidores

## Generar Enlace de Invitación

También puedes generar un enlace de invitación personalizado usando el script incluido:

```bash
node generate-invite.js
```

Este script generará un enlace con todos los permisos necesarios para que el bot funcione correctamente.

## Dependencias

- discord.js - Framework para interactuar con la API de Discord
- distube - Reproductor de música para discord.js
- @distube/yt-dlp - Plugin para mejorar la descarga de YouTube
- @distube/spotify - Plugin para soporte de Spotify
- @distube/soundcloud - Plugin para soporte de SoundCloud
- dotenv - Para manejar variables de entorno

## Licencia

[MIT](LICENSE)

## Autor

[Santino Rosso](https://github.com/santino-rosso)
