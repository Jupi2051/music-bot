# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [Unreleased] — Seguridad

- Hardening anti-RCE: se bloquean queries que empiezan con `-` (inyección de flags de yt-dlp) y protocolos no-http(s) (`file://` → LFI).
- El binario de yt-dlp ya no se auto-actualiza en runtime: se descarga en build-time y node_modules queda inmutable en el contenedor.

## [1.2.1] - 2026-08-02

### Cambiado
- `/play` muestra "📃 Cargando playlist..." para URLs de playlist/álbum/radio (YouTube, Spotify, SoundCloud) en vez del "🔍 Buscando:" genérico, para que la espera de resolución no parezca un cuelgue
- Límite de canciones por playlist/radio de 25 a 15 (la extracción de yt-dlp es secuencial: ~1.5s por canción; una playlist de 25 tardaba ~42s)

## [1.2.0] - 2026-08-02

### Añadido
- Credenciales de Spotify Developer (SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET) para reproducción completa de playlists y álbumes vía la API oficial de Spotify

### Cambiado
- SpotifyPlugin usa la API oficial cuando hay credenciales en `.env`; sin ellas conserva el comportamiento anterior (solo metadata básica)

## [1.1.0] - 2026-08-02

### Añadido
- Validaciones de uso como respuestas ephemeral (solo el usuario las ve) en play, stop, skip, pause, resume, volume, leave y queue
- Tests para errores de ejecución de pause/resume y recorte de puntuación en URLs pegadas
- Guard anti-solapamiento en la actualización periódica de comandos (cada 6h)
- Limpieza automática de entradas vencidas en el Map de cooldowns
- Fallback de CLIENT_ID en update-commands.js para evitar el PUT a `/applications/undefined/commands`

### Cambiado
- skip.js distingue "no hay más canciones" de errores reales al saltar
- cleanQuery recorta puntuación de cierre pegada a URLs (ej: `https://...watch?v=x).`)
- .dockerignore excluye tests, estado de runtime y cookies del build
- .gitignore ya no ignora package-lock.json (debe permanecer commiteado para `npm ci`)

### Corregido
- Carga de comandos ignora archivos no `.js` en la carpeta commands (evitaba crash loop)
- stop.js respondía el error de canal como mensaje público; ahora es ephemeral

## [1.0.0] - 2025-05-25

### Añadido
- Comandos básicos: play, pause, resume, stop, skip, queue, volume, help
- Soporte para YouTube, Spotify y SoundCloud
- Documentación inicial
- Registro global de comandos
- Configuración para múltiples servidores

### Eliminado
- Comandos de utilidad innecesarios (stats, ping, nowplaying)
