# AGENTS.md - Transito Server

Koa + TypeScript API behind the Transito app: it serves the weekly-generated Static Catalogue and
relays live NUS arrivals. Domain terms (Bus Stop, Static Catalogue, Outage, Announcement, Route
Distance Index, ...) are defined in `CONTEXT.md`; use them in code, comments and replies.

## Running the dev stack

- The dev stack (Transito server on 8080, Firebase emulators with the UI on 4000) runs in the tmux
  session `transito`. When a task needs it and `tmux has-session -t transito` fails, start it with
  `fish ~/Developer/Transito/dev-env.fish` (the user's `transito-dev` alias). Read a pane's logs
  with `tmux capture-pane -p -t transito:0.0` (server) or `transito:0.1` (emulators).
- The server pane runs `pnpm run dev` under nodemon, which restarts on source changes; after an
  edit, read the server pane's logs rather than starting a second server on 8080.
- In T3 Code, do work that needs changes to `../transito_flutter` in a new thread in the
  `transito_flutter` project, with a self-contained brief, rather than editing the app from a
  server thread.

## User-owned actions

- Deploys and production calls are the user's: pushes to `main` (CI builds the image and resets the
  GCE VM), `docker compose` against `docker-compose.yml` (CI's file; beta uses
  `docker-compose.beta.yml`), `wrangler deploy`, and requests to `transito-api.tnitish.com` or
  `beta-transito-api.tnitish.com`.
- Values in `.env` and `secrets/` stay with the user: refer to variables by name (`.env.example`
  lists them) and keep values out of output, logs and commits.
- Commits: show the staged diff and a message drafted with the `emoji-git-commit` skill, then wait
  for approval. Commit messages carry no `Co-Authored-By` trailer.

## Verification

A code change is done when these pass:

```bash
pnpm test
pnpm exec tsc -p tsconfig.app.json --noEmit    # type-check src
pnpm exec tsc -p tsconfig.test.json            # type-check tests
```

- Add tests for data transformation, upstream parsing and failure mapping, at the `test/` path
  matching the source. Mock fetchers with `vi.mock` on the path alias, as
  `test/routes/generateJSON.test.ts` does.
- Format to `.prettierrc`.

## Architecture

- Define a route with `defineRoute` and register it with `buildRoute` in `src/server.ts`. Protect
  operator-only routes with `requiresSecret: true`, as `src/routes/alerts/putAnnouncement.ts` does.
- Upstream calls live in `src/fetchers/`, validated with Zod via `zodFetch` or the Univus proxy;
  schemas and their inferred `T*` types live in `src/types/`.
- Path aliases (`@routes`, `@fetchers`, `@utils`, `@app-types`, `@json`) are declared once per
  runtime: `tsconfig.json` (dev), `_moduleAliases` in `package.json` (built `dist/`), and
  `vitest.config.ts` (tests). Change all three together.
- A run saves the Static Catalogue as one file, `static-catalogue.json` in the data directory
  (`DATA_DIR`, `/app/data` in the container), and `src/json/index.ts` serves it from there at
  startup, so it survives restarts and new images. `src/json/bus-stops.json` and
  `src/json/bus-services.json` are the bundled fallback for before any run succeeds: gitignored,
  yet imported by type-check and tests. A fresh worktree needs them; copy them from the main
  checkout or write the empty placeholders the `dockerfile` does.

## Static Catalogue generation

`POST /generate-json` (`src/routes/generateJSON.ts`) builds the catalogue. The Cloudflare cron
worker in `workers/transito-refresh/` starts it weekly, polls `GET /generate-json/last-run` every
minute, and reports the run's summary on Telegram; the production VM's `startup.sh` calls it on
every boot.

- Keep `generateJSON` an orchestrator: put new catalogue logic in its own module under
  `src/fetchers/` or `src/utils/` and call it from there.
- Required data is fetched and checked before any file is written, so a failed fetch leaves the
  previous catalogue in place. Optional data degrades instead: missing NUS checkpoints leave Route
  Distance unknown, and Route Shapes fall back or stay null
  (`docs/adr/0003-build-route-shapes-from-lta-kml-with-onemap-fallback.md`).
- `POST /generate-json` replies 202 and runs in the background, because a run outlasts Cloudflare's
  125 s proxy timeout; a second request while one runs, or before a successful run's restart, gets
  409. The run's status and summary are saved to `last-generate-json-run.json` in the data
  directory for `GET /generate-json/last-run`.
- A successful run exits the process after 5 seconds so its container restarts with the new
  catalogue.
- The run ends by publishing the Route Distance Index to Firebase Storage, best effort. Read
  `docs/adr/0002-publish-route-distance-index-to-firebase-storage.md` before changing it; a change
  to the index shape needs a new object path (`route-distances/v2.json.gz`).
- Run local generation with `ENV=dev`, which uploads the index only to the emulator at
  `FIREBASE_STORAGE_EMULATOR_HOST`. Without `ENV=dev` or the emulator, Google application default
  credentials on the machine can upload to the production bucket. `README.md` lists the variables.

## NUS failures

Read `docs/adr/0001-detect-outages-per-device.md` before changing failure handling: apps detect
Outages per device from their own requests, and the server stores none. The app calls LTA directly,
so the server's part is NUS:

- Calls through the Univus bus proxy (`src/fetchers/univus-bus-proxy-fetcher.ts`) throw
  `UpstreamError` (`src/utils/upstream-error.ts`), with `timedOut` set on timeouts.
- Live NUS routes map `UpstreamError` to 504 when timed out (never an Outage) and 502 otherwise,
  and keep 500 for the server's own failures. Follow `src/routes/univus/getNUSBusArrivals.ts`.
- Optional Arrival Enrichment falls back to an empty value so the arrival still returns.
