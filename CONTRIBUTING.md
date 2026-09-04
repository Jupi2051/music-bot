# Contributing

Thanks for wanting to contribute to GordoDJ! Every contribution helps: bugs, tests, docs and features.

## Code of conduct

Be brief and respectful. This is a community music bot project: technical discussions are settled with evidence, not tone.

## Getting started

1. Fork the repo and clone your fork.
2. Install dependencies: `npm install` (it uses `package-lock.json`, so prefer `npm ci` if you can).
3. Create a `.env` from `.env.example` with your own Discord TOKEN (never commit secrets).
4. Run the tests: `npm test`.

## Golden rules

- **NEVER commit secrets**: `.env`, `cookies.txt`, tokens or credentials never go into the repo. If a `.env` shows up in a diff, the PR is rejected.
- **Always with tests**: every fix or new feature adds or updates tests in `test/`. The suite uses native `node:test` (Node >= 20.18.1).
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. No AI attribution or generated "Co-Authored-By".
- **No smoke**: changes are verified against the full suite (`npm test`) before opening the PR.
- **Minimal changes**: one PR per topic. If you touch more than ~400 lines, split it into smaller PRs.

## Project structure

- `index.js` — bot bootstrap, command/event loading, heartbeat
- `commands/` — one file per slash command
- `events/` — discord.js event handlers
- `config/distube.js` — DisTube instance and plugins (Spotify, SoundCloud, yt-dlp)
- `utils/helpers.js` — shared helpers (cleanQuery, cooldowns, validations)
- `test/` — suite using `node:test` (unit + opt-in integration)

## Integration tests

Integration tests (require network and yt-dlp) run with `npm run test:integration`. They're not part of `npm test` because they depend on the network; use them judiciously.

## Reporting bugs

Before opening an issue, check the "Troubleshooting" section of the README. Include: Node version, `docker logs` output (if applicable), the command that failed and the full error message. Never paste tokens or cookies into the issue.

## PR process

1. Create a branch with a descriptive name (`fix/skip-error`, `feat/equalizer`).
2. Make small, conventional commits.
3. Run `npm test` and make sure it's green.
4. Open the PR with a clear description: what changes, why, and how it was tested.

## Not sure where to start?

Look for issues tagged `good first issue` or open an issue asking — there's always something to do.
