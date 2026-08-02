// Healthcheck: verifica que el bot esté vivo a través del heartbeat en bot-state.json
// Auto-recuperación: si detecta un hang (heartbeat vencido y el proceso lleva >60s
// corriendo), mata el proceso principal (PID 1) para que el restart policy de
// Docker (`restart: unless-stopped`) reinicie el contenedor. Docker NO reinicia
// contenedores `unhealthy` por sí solo; solo reactúa cuando el proceso sale.
const fs = require('fs');
const path = require('path');

const MAX_AGE_MS = 90 * 1000; // el heartbeat se escribe cada 30s; 90s = 3 intervalos perdidos
const MIN_UP_TIME_MS = 60 * 1000; // no matar durante el arranque (el bot aún no escribió heartbeat)

// Lógica pura de decisión (testeable sin /proc).
// - stateExists: false => el bot aún no escribió el primer heartbeat
// - lastUpdate:   timestamp del último heartbeat
// - now:          timestamp actual
// - processStartMs: milisegundos que lleva corriendo el proceso principal, o null si se desconoce
// Devuelve { ok, kill, reason } — kill=true solo cuando es seguro asumir un hang real.
function evaluateHealth({ stateExists, lastUpdate, now, processStartMs }) {
  if (!stateExists) {
    if (processStartMs !== null && processStartMs > MIN_UP_TIME_MS) {
      return { ok: false, kill: true, reason: 'heartbeat nunca escrito y el proceso no está en arranque' };
    }
    return { ok: false, kill: false, reason: 'heartbeat aún no escrito (arranque)' };
  }
  const age = now - lastUpdate;
  if (age > MAX_AGE_MS) {
    if (processStartMs !== null && processStartMs > MIN_UP_TIME_MS) {
      return { ok: false, kill: true, reason: `heartbeat vencido (${Math.round(age / 1000)}s) — proceso colgado` };
    }
    return { ok: false, kill: false, reason: `heartbeat vencido pero proceso joven (${Math.round(age / 1000)}s)` };
  }
  return { ok: true, kill: false, age };
}

// Milisegundos que lleva corriendo el PID 1 del contenedor (Linux).
// Campo 22 (starttime, en ticks desde boot) de /proc/1/stat; CLK_TCK=100 en Linux.
// Devuelve null si no se puede determinar (entorno no-Linux o /proc inaccesible).
function processStartTimeMs() {
  try {
    const stat = fs.readFileSync('/proc/1/stat', 'utf8');
    const rest = stat.slice(stat.lastIndexOf(')') + 2);
    const startTicks = Number(rest.split(' ')[19]);
    const uptimeSec = Number(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
    if (!Number.isFinite(startTicks) || !Number.isFinite(uptimeSec)) return null;
    return uptimeSec * 1000 - startTicks * 10;
  } catch {
    return null;
  }
}

if (require.main === module) {
  const stateFile = path.join(__dirname, 'bot-state.json');
  let state = null;
  try {
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
  } catch (error) {
    console.log('Health check failed: bot-state.json ilegible:', error.message);
    process.exit(1);
  }

  const result = evaluateHealth({
    stateExists: state !== null,
    lastUpdate: state?.lastUpdate,
    now: Date.now(),
    processStartMs: processStartTimeMs(),
  });

  if (result.ok) {
    console.log(
      `Health check passed (heartbeat ${Math.round(result.age / 1000)}s, ping ${state.wsPing}ms, ${state.guildCount} guilds)`,
    );
    process.exit(0);
  }

  console.log('Health check failed:', result.reason);
  if (result.kill) {
    try {
      process.kill(1, 'SIGKILL'); // forzar reinicio por el restart policy
      console.log('Proceso principal terminado — Docker reiniciará el contenedor');
    } catch (error) {
      console.log('No se pudo terminar el proceso principal:', error.message);
    }
  }
  process.exit(1);
}

module.exports = { evaluateHealth, MAX_AGE_MS, MIN_UP_TIME_MS };
