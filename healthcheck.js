// Healthcheck: verifies the bot is alive via the heartbeat in bot-state.json
// Auto-recovery: if it detects a hang (heartbeat expired and the process has
// been running for >60s), it kills the main process (PID 1) so Docker's
// restart policy (`restart: unless-stopped`) restarts the container. Docker
// does NOT restart `unhealthy` containers on its own; it only reacts when the
// process exits.
const fs = require('fs');
const path = require('path');

const MAX_AGE_MS = 90 * 1000; // heartbeat is written every 30s; 90s = 3 missed intervals
const MIN_UP_TIME_MS = 60 * 1000; // don't kill during startup (the bot hasn't written a heartbeat yet)

// Pure decision logic (testable without /proc).
// - stateExists: false => the bot hasn't written the first heartbeat yet
// - lastUpdate:   timestamp of the last heartbeat
// - now:          current timestamp
// - processStartMs: milliseconds the main process has been running, or null if unknown
// Returns { ok, kill, reason } — kill=true only when it's safe to assume a real hang.
function evaluateHealth({ stateExists, lastUpdate, now, processStartMs }) {
  if (!stateExists) {
    if (processStartMs !== null && processStartMs > MIN_UP_TIME_MS) {
      return { ok: false, kill: true, reason: 'heartbeat never written and the process is not starting up' };
    }
    return { ok: false, kill: false, reason: 'heartbeat not written yet (starting up)' };
  }
  const age = now - lastUpdate;
  if (age > MAX_AGE_MS) {
    if (processStartMs !== null && processStartMs > MIN_UP_TIME_MS) {
      return { ok: false, kill: true, reason: `heartbeat expired (${Math.round(age / 1000)}s) — process hung` };
    }
    return { ok: false, kill: false, reason: `heartbeat expired but process is young (${Math.round(age / 1000)}s)` };
  }
  return { ok: true, kill: false, age };
}

// Milliseconds the container's PID 1 has been running (Linux).
// Field 22 (starttime, in ticks since boot) of /proc/1/stat; CLK_TCK=100 on Linux.
// Returns null if it can't be determined (non-Linux environment or /proc inaccessible).
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
    console.log('Health check failed: bot-state.json unreadable:', error.message);
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
      process.kill(1, 'SIGKILL'); // force a restart via the restart policy
      console.log('Main process terminated — Docker will restart the container');
    } catch (error) {
      console.log('Could not terminate the main process:', error.message);
    }
  }
  process.exit(1);
}

module.exports = { evaluateHealth, MAX_AGE_MS, MIN_UP_TIME_MS };
