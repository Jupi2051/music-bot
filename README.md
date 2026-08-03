# GordoDJ - Bot de Música para Discord

Un bot de música para Discord que te permite reproducir música de YouTube, Spotify, SoundCloud y más directamente en tus canales de voz.

## Invitar al Bot

Para añadir GordoDJ a tu servidor, haz clic en el siguiente enlace:

[**Invitar GordoDJ a tu servidor**](https://discord.com/api/oauth2/authorize?client_id=1376190250120122452&permissions=1024+2048+16384+65536+1048576+2097152&scope=bot%20applications.commands)

También puedes regenerar el enlace en cualquier momento:

```bash
node generate-invite.js
```

## Características

- Reproducción de música desde múltiples fuentes (YouTube, Spotify, SoundCloud)
- Comandos de control de reproducción (play, pause, resume, skip, stop)
- Control de volumen
- Cola de reproducción con límite de 100 canciones
- Soporte para playlists
- Control de acceso: solo quien está en el mismo canal de voz controla el bot
- Cooldown de 5s por usuario en `/play` para evitar abuso

## Comandos

- `/play [cancion]` - Reproduce una canción o playlist
- `/stop` - Detiene la música y el bot sale del canal de voz
- `/skip` - Salta a la siguiente canción
- `/pause` - Pausa la canción actual
- `/resume` - Reanuda la canción pausada
- `/queue` - Muestra la lista de canciones en cola
- `/volume [1-100]` - Cambia el volumen del bot
- `/leave` - Hace que el bot salga del canal de voz
- `/help` - Muestra la lista de comandos disponibles

## Requisitos

- Node.js v20.18.1 o superior
- FFmpeg instalado en el sistema (o el contenedor de Docker lo incluye)
- Token de bot de Discord
- ID de aplicación de Discord

## Instalación

1. Clona este repositorio:
   ```
   git clone https://github.com/santino-rosso/BotMusicaDiscord.git
   cd BotMusicaDiscord
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto:
   ```
   TOKEN=tu_token_de_discord
   CLIENT_ID=tu_id_de_aplicacion
   ```

4. (Opcional) Para reproducción completa de playlists y álbumes de Spotify, creá una app en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) y agregá las credenciales al `.env`:
   ```
   SPOTIFY_CLIENT_ID=tu_spotify_client_id
   SPOTIFY_CLIENT_SECRET=tu_spotify_client_secret
   ```
   Sin ellas, Spotify funciona a medias (solo canciones individuales). El audio siempre se reproduce desde YouTube; las credenciales solo habilitan la resolución de listas completas.

5. Inicia el bot:
   ```
   node index.js
   ```

Los comandos slash se registran automáticamente al arrancar (y se re-sincronizan cada 6 horas si cambian).

### Docker

```bash
docker compose up -d --build
```

El contenedor incluye healthcheck real (heartbeat cada 30s), límites de memoria/CPU y rotación de logs.

## Configuración en Discord Developer Portal

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación o selecciona una existente
3. Ve a la sección "Bot" y genera un token (guardalo en `.env`)
4. Ve a OAuth2 > URL Generator, selecciona los scopes "bot" y "applications.commands"
5. Selecciona los permisos: View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak
6. Usa la URL generada para invitar al bot a tus servidores

> **Intents**: el bot solo necesita `Guilds`, `GuildMessages` y `GuildVoiceStates` (todos no-privilegiados). No hace falta habilitar Message Content, Server Members ni Presence en el portal.

## Solución de problemas

- **"No se pudo reproducir"**: revisá los logs (`docker logs gordodj-bot`). Si aparece `Sign in to confirm you're not a bot`, YouTube está bloqueando la IP; el bot usa el cliente `android` de yt-dlp para evitarlo y, si es necesario, podés montar `cookies.txt` (formato Netscape) en la raíz del proyecto — el contenedor lo detecta automáticamente.
- **El bot no responde**: verificá que esté `healthy` (`docker ps`) y que el token del `.env` sea válido.

## Dependencias

- discord.js - Framework para interactuar con la API de Discord
- distube - Reproductor de música para discord.js
- @distube/yt-dlp - Plugin para extracción de YouTube
- @distube/spotify - Plugin para soporte de Spotify
- @distube/soundcloud - Plugin para soporte de SoundCloud
- dotenv - Para manejar variables de entorno

## Testing

```bash
npm test                  # Unit tests (node:test, sin red ni dependencias extra)
npm run test:integration  # Opt-in: red real contra YouTube (requiere binario yt-dlp local)
```

Los tests de integración (`test/integration/`) quedan skipped en `npm test`; cubren la resolución de videos individuales y de radios RD acotadas (`--playlist-end 25`).

## Mejoras futuras

- **Escalado a cientos/miles de servidores**: sharding (una instancia por shard) + Redis para estado compartido + servicio de audio separado (Lavalink) + cookies/proxies rotativos para yt-dlp. El código ya está preparado (estado de colas aislado por guild en DisTube, sin estado global frágil); aplicar cuando el bot alcance ~100+ servidores o se acerque al límite práctico de guilds de discord.js (~2.500).

## Licencia

[MIT](LICENSE)

## Autor

[Santino Rosso](https://github.com/santino-rosso)
