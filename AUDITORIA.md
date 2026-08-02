# Análisis del proyecto — BotMusicaDiscord (GordoDJ)

> Auditoría técnica completa realizada el 2026-08-02, previa a cualquier modificación.
> Estado del repo en el momento de la auditoría: `bde4c24` ("arreglo cambios").
> Este documento es la fuente de verdad del plan de mejoras; actualizarlo a medida que se resuelven ítems.

## Resumen ejecutivo

Bot de música para Discord en Node.js (discord.js 14 + DisTube 5) con 9 comandos slash, soporte para YouTube/Spotify/SoundCloud, y deployment por Docker para VPS. Proyecto chico (~33 archivos), bien organizado (file-based handlers), sin secrets expuestos.

Problemas serios de robustez y producción:

- Puede crashear justo cuando ocurre un error de reproducción (firma del evento `error` de DisTube v4 en v5, verificado contra la doc oficial).
- Sin handlers globales de `unhandledRejection`/`uncaughtException`.
- Código muerto (`events/distubeEvents.js` nunca se ejecuta) y eventos duplicados.
- Sin control de acceso ni rate limiting.
- Deployment con bugs silenciosos (Node 18 EOL, yt-dlp congelado, healthcheck no-op).
- Cero tests.

Apto para uso personal / 1–2 servidores. Para decenas: estabilizar primero. Para cientos/miles: re-arquitectura (sharding + audio separado).

## Arquitectura actual

```
index.js (punto de entrada)
├── Client discord.js (intents: Guilds, GuildMessages, MessageContent, GuildVoiceStates)
├── Carga file-based: commands/*.js  →  client.commands
├── Carga file-based: events/*.js    →  client.on(...)
├── config/distube.js → instancia única global DisTube en client.distube (colas por guild internas)
├── ready: presence + checkAndUpdateCommands() + setInterval 6h
└── client.login(TOKEN) sin .catch

commands/ (9): play, skip, volume, stop, leave, pause, queue, help, resume
events/ (3): ready.js, interactionCreate.js, distubeEvents.js (MUERTO)
Scripts: deploy-commands.js, update-commands.js, generate-invite.js,
         healthcheck.js, run-forever.js, start-vm.sh, ecosystem.config.json (PM2)
```

- **Punto de entrada** (`index.js`, 63 líneas): crea el client, carga comandos/eventos del filesystem, instancia DisTube vía factory, login. `ready` manejado dos veces (inline en `index.js:44-61` + `events/ready.js`).
- **Estado**: una instancia global de DisTube (`client.distube`) con mapa interno de colas por guild id. Sin persistencia real: `commands-state.json` guarda solo el hash de deploy; los volúmenes `data/` y `logs/` del compose no los escribe nadie.
- **Config**: solo `TOKEN` y `CLIENT_ID` vía dotenv, sin validación al arrancar.

## Flujo de funcionamiento

1. `index.js` carga dotenv → instancia Client → carga comandos/eventos → instancia DisTube → `login(TOKEN)`.
2. En `ready`: presencia → `checkAndUpdateCommands()` (hash MD5 vs `commands-state.json`; si cambia, PUT global) → check cada 6 h.
3. `/play <query>` → `interactionCreate.js` despacha → `play.js` valida voice channel del usuario → reply "🔍 Buscando..." → `client.distube.play(voiceChannel, query, { textChannel, member })`.
4. DisTube resuelve (URL directa o búsqueda YouTube vía yt-dlp / Spotify / SoundCloud), conecta y streamea: yt-dlp extrae URL → ffmpeg transcodifica a Opus → websocket de voz.
5. Eventos `playSong`/`addSong`/`addList` notifican en el canal de texto; `finish`/`empty`/`disconnect` avisan el fin.
6. `/stop` detiene y fuerza `connection.leave()` (doble desconexión defensiva).

## Sistema de música

- **Librerías**: `distube@5.0.7` + `@distube/yt-dlp@2.0.1`, `@distube/spotify@2.0.2`, `@distube/soundcloud@2.0.4` + `@discordjs/opus`.
- **Obtención**: texto libre → búsqueda YouTube; URL → plugin correspondiente; playlists → encoladas (`addList`). Binario `yt-dlp` descargado en postinstall, auto-update en cada arranque (`update: true` default).
- **Sin cookies de YouTube** → videos restringidos fallan; riesgo de bot-check a escala.
- **Procesamiento**: streaming puro, sin archivos de audio en disco. Cada cola activa: 1 yt-dlp intermitente (~80–120 MB RAM) + 1 ffmpeg (CPU intensivo).
- **Config**: `emitNewSongOnly: true`, `nsfw: false`. Sin `initQueue`. Opciones `leaveOn*` no existen en v5 (comportamiento default).
- **Error de reproducción**: handler `error` en `config/distube.js:31-34` es el talón de Aquiles (C1).

## Discord

- **Intents**: Guilds, GuildMessages, MessageContent (privilegiado, sin uso), GuildVoiceStates.
- **Comandos**: 9 slash commands globales; despacho solo `isChatInputCommand()` (sin botones/menús/autocompletado).
- **Registro**: `update-commands.js` (hash MD5 + estado en archivo, bug de orden) + `deploy-commands.js` manual duplicado con divergencias. Propagación global hasta ~1 h.
- **Desconexión**: default de DisTube v5; `/stop` y `/leave` fuerzan `voices.get(...).leave()`.
- **Permisos invite** (`generate-invite.js`, bitmask 12666880): Send Messages, Embed Links, Read Message History, Connect, Speak, Mute Members (innecesario). **Falta View Channels**. Comentarios del archivo describen mal 4 de 8 bits.
- **Cooldowns/rate limiting**: no existen. **Permisos de usuario**: no se chequean; `/play` solo exige estar en un canal de voz (no el mismo que el bot).

## Seguridad

Sin secrets expuestos (token solo en `.env`, gitignoreado, excluido del Dockerfile). Sin command injection (el único `exec` es string fijo en `run-forever.js:20`). Sin path traversal.

| # | Hallazgo | Ubicación | Impacto |
|---|---|---|---|
| S1 | Crash en el camino del error (firma v4 en v5) | `config/distube.js:31-34` | Proceso muere al fallar reproducción |
| S2 | Sin handlers globales; sends sin `.catch` | `index.js`, `config/distube.js:22-40` | Cualquier rechazo tumba el proceso |
| S3 | Sin control de acceso ni mismo-canal | `commands/*.js` | Cualquier miembro controla el reproductor |
| S4 | Sin rate limiting + playlists sin límite | `play.js`, `index.js` | DoS de recursos; rate limit de YouTube |
| S5 | Interpolación sin escapar (`song.name`, `query`, `error.message`) | `config/distube.js:23,26,29,39`, `queue.js:11`, `play.js:17,26` | Mention spam; fuga de detalles internos |
| S6 | CLIENT_ID hardcodeado (fallback) | `generate-invite.js:2` | Público; mantenimiento |
| S7 | Permisos invite: Mute Members de más, View Channels faltante | `generate-invite.js` | Least privilege violado; funcional rota |

## Rendimiento

| Escenario | Estado |
|---|---|
| 1 servidor | Sin problemas (~150–250 MB RAM) |
| 10 servidores | OK; ~1 ffmpeg + picos de yt-dlp por stream activo |
| 100 servidores | Cuello en CPU: ~10 ffmpeg + ~10 yt-dlp = 2–4 núcleos, 1.5–2 GB. Rate limits de YouTube por IP; yt-dlp congelado (auto-update falla silencioso) |
| 1.000 servidores | Inviable monoproceso: sin sharding, transcode local no escala, IP compartida = bloqueos |

Cuellos de botella: **ffmpeg (CPU)**, **yt-dlp (RAM/red/rate limits)**, **single-process sin sharding**, **sin límites de cola ni cooldowns**, **logs sin rotación**.

## Escalabilidad

- **Multi-guild simultáneo**: sí funciona. DisTube aísla estado por guild id; no hay estado compartido incorrecto entre guilds.
- **Límites**: (1) una instancia/un proceso — PM2 multi-instancia fragmentaría colas y voz; (2) sin sharding (límite práctico ~2.5k guilds); (3) sin observabilidad; (4) yt-dlp sin cookies/proxies → bloqueos tempranos.

## Dependencias

| Paquete | Versión | Estado (ago-2026) | Nota |
|---|---|---|---|
| discord.js | 14.19.3 | 8 minors detrás (14.27.0) | Compatible con distube 5 |
| distube | 5.0.7 | 1.3 años detrás (5.2.3) | Actualizar exige Node ≥22.12 |
| @distube/yt-dlp, spotify, soundcloud | 2.0.x | Al día | — |
| @discordjs/opus | 0.10.0 | Al día | — |
| dotenv | 16.5.0 | 1 major detrás (17.x) | — |

Problemas:
- `engines` falso (`package.json:30` ≥16.9.0): discord.js exige ≥18.17, **undici 7 (vía distube) exige ≥20.18.1** → imagen Node 18 corre combo no soportado.
- **Lockfile corrupto**: `express ^5.1.0` fantasma en la raíz del lock (~47 paquetes muertos). Regenerar con `npm install`.
- `nodemon` no declarado → `npm run dev` roto.
- Cadena vieja: `spotify-web-api-node` → `superagent@6.1.0` → `formidable@1.2.6` (2018, CVEs de DoS históricos; riesgo práctico bajo).
- Críticas: `distube` + `@distube/yt-dlp` (corazón del bot; actualización riesgosa, requiere Node 22).

## Deployment

- **Dockerfile**: `node:18-slim` **EOL** (abril 2025). `ffmpeg` necesario ✅; `python3`+`git` innecesarios. **Bug de ownership**: `chown` antes de `npm ci` → `node_modules` root-owned → auto-update de yt-dlp falla EACCES en silencio → **yt-dlp congelado para siempre**. Sin tini/init. HEALTHCHECK anulado por compose.
- **docker-compose**: `version: '3.8'` obsoleto; `deploy.resources` **ignorado por `docker compose up`** (solo Swarm); healthcheck = `console.log('Health check')` (siempre pasa); bind mounts `data/`/`logs/` sin uso (+ mismatch uid 1000/1001); logs sin rotación; `restart: unless-stopped` ✅.
- **healthcheck.js**: verifica existencia de `index.js`/`node_modules` + `bot-state.json` que **nadie escribe** → no detecta bot colgado.
- **run-forever.js / ecosystem.config.json**: huérfanos; crash-loop naíf sin backoff.
- **start-vm.sh**: sólido. **VM-SETUP.md** con errores (`docker compose pull` falla, puertos 80/443 innecesarios, path scp equivocado).

## Testing

**No existe ningún test.** Estrategia propuesta:
1. Unit de comandos (mock interaction + client.distube; todas las ramas de validación).
2. Unit de eventos DisTube (mensajes emitidos; caso textChannel ausente; firma correcta del error).
3. Lógica de cola (wrapper; encolar/skip/stop/límites/cooldowns).
4. Gestión de guilds (aislamiento entre dos guilds).
5. update-commands (orden hash-vs-deploy, primer arranque).
6. Integración opt-in con APIs externas (`@integration`).
7. E2E manual en servidor de pruebas.

## Problemas encontrados

### 🔴 Críticos

**C1. Crash en el camino del error (DisTube v5 con firma v4)**
- Archivo: `config/distube.js:31-34` (y `events/distubeEvents.js:11-14`).
- Problema: en v5 la firma es `error(error, queue, song?)`; el código usa `(channel, error)`. `channel.send(...)` sobre un `Error` → `TypeError` dentro del listener de error.
- Impacto: el proceso muere justo cuando falla una reproducción, sin handler global.
- Solución: `distube.on('error', (error, queue) => { console.error(error); queue?.textChannel?.send('...').catch(...) })`. ✅ Verificado contra doc oficial.

**C2. Cero protección contra promesas rechazadas**
- Archivo: `index.js` (login sin `.catch` línea 63, sin `unhandledRejection`/`uncaughtException`/`client.on('error')`); `config/distube.js:22-40` (sends sin `.catch`).
- Impacto: cualquier rechazo (canal borrado, sin View Channel, rate limit, interacción ya respondida) tumba el proceso.
- Solución: handlers globales + `.catch()` en todos los sends + `login().catch()` con validación de env.

**C3. Imagen Node 18 EOL + engines falso + yt-dlp congelado**
- Archivo: `Dockerfile:1,22,28`, `package.json:30`.
- Impacto: imagen vulnerable, combo no soportado con undici 7, pérdida silenciosa de YouTube.
- Solución: `node:22-slim`, corregir `engines`, reordenar chown o `YTDLP_DISABLE_DOWNLOAD=1` + descarga explícita en build.

### 🟠 Altos

**A1. Sin control de acceso ni check de mismo canal** — `commands/*.js` (play.js:14 solo valida estar en *un* canal). Solución: helper `assertControl` (mismo voice channel o rol DJ) + permisos en builders.
**A2. Sin rate limiting ni límites de cola** — `play.js`, `index.js`. Solución: cooldown por usuario (3–5 s), máx. canciones por playlist/cola, máx. duración opcional.
**A3. `update-commands.js` guarda el hash ANTES del deploy** — `update-commands.js:49-53` vs `64-69`. Solución: desplegar primero, guardar después.
**A4. `events/distubeEvents.js` es código muerto** — `index.js:30-38` espera `{name, once, execute}`; exporta función → `client.on(undefined)` nunca dispara. Solución: eliminar o migrar; centralizar eventos en un solo lugar.
**A5. Healthcheck decorativo** — `docker-compose.yml:17-22`, `healthcheck.js:7-31`. Solución: heartbeat real (timestamp + estado del gateway).
**A6. Interpolación sin escapar** — `config/distube.js:23,26,29,39`, `queue.js:11`, `play.js:17,26`. Solución: `escapeMarkdown()` + errores genéricos.

### 🟡 Medios

**M1.** `deploy.resources` ignorado — `docker-compose.yml:24-31`. Solución: `mem_limit`/`cpus` del compose v2.
**M2.** Lockfile corrupto (express fantasma) — `package-lock.json`. Solución: regenerar.
**M3.** `npm run dev` roto — `package.json:8` (nodemon no declarado).
**M4.** Permisos invite incorrectos — `generate-invite.js:4-13` (falta View Channels 1024, sobra Mute Members 4194304, 4 comentarios falsos).
**M5.** Doble reply en catch global — `events/interactionCreate.js:9-14` → `InteractionAlreadyReplied` no capturado. Solución: `if (replied || deferred) editReply` else `reply`.
**M6.** `queue.js` sin límite de longitud — `commands/queue.js:11-12` (>2000 chars rompe).
**M7.** Intent `MessageContent` innecesario — `index.js:15`.
**M8.** Volúmenes muertos + uid mismatch — `docker-compose.yml:12-14,37-39`.
**M9.** `skip.js` enmascara errores — `commands/skip.js:13-16`.
**M10.** `commands-state.json` commiteado — estado runtime en git.
**M11.** Duplicación deploy/update — `deploy-commands.js` vs `update-commands.js`.
**M12.** yt-dlp sin cookies — `config/distube.js:13`.

### 🟢 Bajos

**B1.** `flags: 64` mágico vs `ephemeral: true` — `interactionCreate.js:13`, `help.js:20`.
**B2.** Docs desincronizadas: `/leave` y `/help` faltan en `help.js:8-16` y README; CHANGELOG sin entradas desde 2025-05; repos `tuusuario/gordodj` vs `santino-rosso/BotMusicaDiscord`.
**B3.** `getQueue` inconsistente: `interaction` (5 cmd), `interaction.guild` (stop.js:8), `interaction.guild.id` (leave.js:8).
**B4.** Mensajes de error inconsistentes entre comandos.
**B5.** `stop.js:15-21` doble desconexión defensiva pese al comentario "Esto también desconecta".
**B6.** `setInterval` 6 h sin cleanup; doble handler `ready`.
**B7.** `run-forever.js`/`ecosystem.config.json` huérfanos; crash-loop sin backoff.
**B8.** `version: '3.8'` obsoleto; `--only=production` deprecado (`Dockerfile:28`).
**B9.** MD5 para hash de comandos (bajo riesgo: solo detecta cambios).
**B10.** CLIENT_ID hardcodeado en 2 lugares.

## Arquitectura recomendada

**Conservar**: file-based handlers, aislamiento por guild de DisTube, plugins de música, simplicidad.

**Componentes propuestos**:
1. `src/bot.js` — client + intents mínimos, validación de env, handlers de crash, graceful shutdown.
2. `src/commands/` + helpers compartidos — `assertUserInVoice`, `assertSameVoiceChannel`, `deferAndReply`, `replyError`, cooldowns (Map TTL / Redis).
3. `src/music/manager.js` — wrapper DisTube: eventos centralizados, escapeMarkdown, check `textChannel`, `.catch()` en sends, límites de cola.
4. `src/store/` — estado por guild (hoy DisTube; Redis a escala multi-proceso).
5. `src/logger.js` — logger estructurado con rotación (pino/winston).
6. `src/health.js` — heartbeat real (timestamp + wsPing + guildCount cada 30 s; endpoint HTTP opcional).
7. `src/commands/registry.js` — deploy unificado: comparar → desplegar → guardar estado; `commands-state.json` a `.gitignore`.
8. **Sharding** (500–1000+ guilds): `ShardingManager`; una DisTube por shard.

**Escalado a cientos/miles**: separar gateway (shardeable) del audio (Lavalink o servicio dedicado) + Redis + cookies/proxies rotativos para yt-dlp.

## Plan de mejoras

**Fase 0 — Estabilidad (hoy)** — *porque C1/C2 son crash en producción*:
1. Corregir firma del evento `error` (C1) y unificar eventos de DisTube en un solo archivo (A4).
2. Handlers globales `unhandledRejection`/`uncaughtException`/`client.on('error')` + `.catch()` en todos los sends + `login().catch()` con validación de env (C2).
3. Fix del doble reply en el catch global (M5).

**Fase 1 — Seguridad y abuso (1 día)**:
4. Control de acceso: mismo voice channel + permisos (A1).
5. Cooldowns y límites de cola/playlist (A2).
6. `escapeMarkdown()` y errores genéricos (A6).

**Fase 2 — Deploy en producción (1–2 días)**:
7. Node 22, `engines`, regenerar lock, fix chown/yt-dlp (C3, M2).
8. Healthcheck real + heartbeat (A5), límites de memoria en compose (M1), rotación de logs.
9. Borrar huérfanos `run-forever.js`/`ecosystem.config.json` (B7), volúmenes muertos (M8).

**Fase 3 — Higiene y calidad (2–3 días)**:
10. Código muerto restante, unificar deploy/update con orden correcto (A3, M11), `commands-state.json` fuera de git (M10).
11. Permisos invite (M4), `MessageContent` (M7), mensajes y docs (B2–B4).

**Fase 4 — Testing (3–5 días)**: estrategia de la sección Testing.

**Fase 5 — Escalado (cuando haga falta)**: sharding → Redis → servicio de audio separado + cookies/proxies.

---

## Seguimiento de estado

| Ítem | Estado | Notas |
|---|---|---|
| F0.1 Firma evento `error` + unificar eventos | ✅ | `config/distube.js` firma v5 `(error, queue)` + helper `sendToChannel` con `.catch`; `events/distubeEvents.js` eliminado |
| F0.2 Handlers globales + `.catch()` sends + `login().catch()` | ✅ | `index.js`: validación TOKEN, `unhandledRejection`/`uncaughtException`/`client.on('error')`, login con catch |
| F0.3 Doble reply catch global | ✅ | `events/interactionCreate.js`: `replied/deferred` → `editReply`, si no `reply ephemeral` |
| F1.1 Control de acceso | ✅ | `utils/helpers.js` `assertControl`: exige mismo voice channel en skip/stop/pause/resume/volume/leave |
| F1.2 Cooldowns y límites | ✅ | `checkCooldown` 5s por guild+user en `/play`; `MAX_QUEUE_SIZE=100` con recorte en addSong/addList (DisTube v5 no tiene maxQueueSize nativo) |
| F1.3 EscapeMarkdown | ✅ | `escapeMarkdown` en playSong/addSong/addList/searchNoResult/queue/play; error genérico en play.js (sin filtrar `error.message`) |
| F2.1 Node 22 + lock + chown/yt-dlp | ✅ | Dockerfile `node:22-bookworm-slim`, `--omit=dev`, chown DESPUÉS de npm ci (yt-dlp puede auto-update); engines `>=20.18.1`; lock sincronizado. **Lección**: @discordjs/opus 0.10.0 NO tiene prebuild para Node 22 (ABI 127) → python3+build-essential son NECESARIOS para compilar desde source (el build de Docker lo confirmó) |
| F2.2 Healthcheck real + límites + logs | ✅ | Heartbeat en index.js (bot-state.json cada 30s: lastUpdate/wsPing/guildCount); healthcheck.js verifica edad ≤90s; compose con `mem_limit: 1g`/`cpus: 1.0` reales, healthcheck real y rotación de logs (10m x 3). Verificado: build Docker OK, contenedor falla limpio con token inválido, health=unhealthy detectado. **Prueba en vivo 2026-08-02**: healthy, 9 comandos registrados en API |
| F2.3 Huérfanos + volúmenes | ✅ | Borrados `run-forever.js` y `ecosystem.config.json`; compose sin volumes muertos ni red custom; `start-vm.sh` sin mkdir data/logs |
| F2.4 Audit de dependencias | ✅ | 0 vulnerabilidades (antes 18). `npm audit fix`: undici 6.21.3 → 6.28.0 (plugins distube). `overrides: tar ^7.5.21` elimina la cadena crítica tar←node-pre-gyp←opus (build-time); verificado con build Docker + carga de opus |
| F3.1 Deploy unificado + estado fuera de git | ✅ | `update-commands.js`: estado se guarda SOLO después de deploy exitoso (antes se guardaba primero y un deploy fallido nunca se reintentaba); `commands-state.json` + `bot-state.json` fuera de git; B3 resuelto (todos usan `getQueue(interaction)`) |
| F3.2 Permisos + intents + docs | ✅ | `generate-invite.js`: permisos reales (View Channels 1024, sin Mute Members, comentarios corregidos); `MessageContent` eliminado de index.js (intent no-privilegiado sobrante); help.js con /leave y /help; README reescrito (repo, Node 20.18+, intents reales, deploy automático); B4: mensajes unificados |
| F4.1 Estrategia de testing | ✅ | `node:test` (sin dependencias): 56 tests en `test/` (helpers 7, comandos 31, update-commands 5 con orden hash-vs-deploy, distube-events 12). `npm test` = `node --test "test/*.test.js"` (Node 22.14 no acepta directorio como arg). Faltan: red real de Discord (integración opt-in) e interactionCreate/ready |
| F5.1 Sharding/Redis/audio separado | ⬜ | |
