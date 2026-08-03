# Contributing

¡Gracias por querer contribuir a GordoDJ! Todo aporte suma: bugs, tests, documentación y features.

## Código de conducta

Se breve y respetuoso. El proyecto es un bot de música comunitario: las discusiones técnicas se resuelven con evidencia, no con tono.

## Empezando

1. Forkeá el repo y cloná tu fork.
2. Instalá dependencias: `npm install` (usa `package-lock.json`, así que preferí `npm ci` si podés).
3. Creá un `.env` a partir de `.env.example` con tu propio TOKEN de Discord (nunca commitees secretos).
4. Corré los tests: `npm test`.

## Reglas de oro

- **NUNCA commitees secretos**: `.env`, `cookies.txt`, tokens o credenciales jamás entran al repo. Si un `.env` está en un diff, se rechaza el PR.
- **Siempre con tests**: cada fix o feature nueva agrega o actualiza tests en `test/`. La suite usa `node:test` nativo (Node >= 20.18.1).
- **Commits convencionales**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Sin atribución AI ni "Co-Authored-By" generados.
- **Sin humo**: los cambios se prueban contra la suite completa (`npm test`) antes de abrir el PR.
- **Cambios mínimos**: un PR por tema. Si tocás más de ~400 líneas, dividí en PRs más chicos.

## Estructura del proyecto

- `index.js` — bootstrap del bot, carga de comandos y eventos, heartbeat
- `commands/` — un archivo por slash command
- `events/` — manejadores de eventos de discord.js
- `config/distube.js` — instancia de DisTube y plugins (Spotify, SoundCloud, yt-dlp)
- `utils/helpers.js` — helpers compartidos (cleanQuery, cooldowns, validaciones)
- `test/` — suite con `node:test` (unit + integración opt-in)

## Tests de integración

Los tests de integración (requieren red y yt-dlp) corren con `npm run test:integration`. No son parte de `npm test` porque dependen de red; usalos con criterio.

## Reportar bugs

Antes de abrir un issue, revisá la sección "Solución de problemas" del README. Incluí: versión de Node, salida de `docker logs` (si aplica), el comando que falló y el mensaje de error completo. Nunca pegues tokens ni cookies en el issue.

## Proceso de PR

1. Creá una branch con nombre descriptivo (`fix/skip-error`, `feat/equalizer`).
2. Hacé commits pequeños y convencionales.
3. Corré `npm test` en verde.
4. Abrí el PR con descripción clara: qué cambia, por qué, y cómo se probó.

## Duda

¿No sabés por dónde empezar? Buscá issues etiquetados `good first issue` o abrí un issue preguntando — siempre hay algo para hacer.
