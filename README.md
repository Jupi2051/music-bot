# GordoDJ - Bot de Música para Discord

Un bot de música para Discord que te permite reproducir música de YouTube, Spotify, SoundCloud y más directamente en tus canales de voz.

## Características

- Reproducción de música desde múltiples fuentes (YouTube, Spotify, SoundCloud)
- Comandos de control de reproducción (play, pause, resume, skip, stop)
- Control de volumen
- Cola de reproducción
- Soporte para playlists

## Comandos

### Comandos de Música
- `/play [cancion]` - Reproduce una canción o playlist
- `/stop` - Detiene la música y el bot sale del canal de voz
- `/skip` - Salta a la siguiente canción
- `/pause` - Pausa la canción actual
- `/resume` - Reanuda la canción pausada
- `/queue` - Muestra la lista de canciones en cola
- `/volume [1-100]` - Cambia el volumen del bot
- `/nowplaying` - Muestra información detallada sobre la canción actual

### Comandos de Utilidad
- `/help` - Muestra la lista de comandos disponibles
- `/ping` - Comprueba la latencia del bot
- `/stats` - Muestra estadísticas del bot

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

### Hosting en Replit (Recomendado)

Este bot está optimizado para ser hosteado en Replit de forma gratuita. Para una guía detallada, consulta [REPLIT_GUIDE.md](REPLIT_GUIDE.md).

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
