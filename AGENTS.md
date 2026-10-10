# AGENTS.md - Transito Server

Koa + TypeScript API behind the Transito app. It serves a weekly-generated Static Catalogue of bus
stops and services and relays live NUS arrivals. Domain terms (Bus Stop, Provider Source, Outage,
Announcement, Route Distance Index, ...) are defined in `CONTEXT.md`; use them in code, comments and
replies. Decisions and their reasons live in `docs/adr/`; read the relevant ADR before changing
behaviour it covers.

## Working rules

- The user runs the local dev stack with the fish alias `transito-dev`; leave `pnpm dev` and
  long-running servers to them. Before asking them to start it, check port 8080 is listening
  (`lsof -nP -iTCP:8080 -sTCP:LISTEN`).
- Treat `.env` and `secrets/` as opaque: reference variables by name (see `.env.example`) and keep
  their values out of output, logs and commits.
- Leave deploys and production calls to the user: pushes to `main` (CI deploys them), `docker
  compose` against `docker-compose.yml`, `wrangler deploy`, and requests to
  `transito-api.tnitish.com` or `beta-transito-api.tnitish.com`.
- Commits: show the staged diff and a message drafted with the `emoji-git-commit` skill, then wait
  for approval. Commit messages carry no `Co-Authored-By` trailer.

## Verify

```bash
pnpm test                                      # Vitest, test/ mirrors src/
pnpm exec tsc -p tsconfig.app.json --noEmit    # type-check src
pnpm exec tsc -p tsconfig.test.json            # type-check tests
```

Formatting follows `.prettierrc` (tabs, no semicolons, width 100). Add tests for data
transformation, upstream parsing and failure mapping; tests mock fetchers with `vi.mock` on the
path alias (see `test/routes/generateJSON.test.ts`).

## Architecture

- `src/server.ts` registers every route with `buildRoute`; a new route is defined with
  `defineRoute` and added there.
- `src/routes/`: handlers. `src/fetchers/`: one module per upstream call, validated with Zod via
  `zodFetch` or the Univus proxy. `src/utils/`: shared logic. `src/types/`: Zod schemas and their
  inferred `T*` types.
- `src/json/*.json` is the generated Static Catalogue: gitignored, yet imported at startup and by
  type-check. A fresh worktree needs it; copy it from the main checkout or write the empty
  placeholders the `dockerfile` does.
- Path aliases `@routes`, `@fetchers`, `@utils`, `@app-types`, `@json` are declared three times:
  `tsconfig.json` (dev), `_moduleAliases` in `package.json` (built `dist/`), and
  `vitest.config.ts`. Change all three together.
- `workers/transito-refresh/`: Cloudflare cron worker that calls `POST /generate-json` weekly.

## Conventions

- `generateJSON` orchestrates the Static Catalogue build. Put new catalogue logic in its own module
  under `src/fetchers/` or `src/utils/` and call it from `generateJSON`, as the fetchers and
  `publishRouteDistanceIndex` are, so the route file stays an orchestrator.
- Required data failing fails the whole run before any file is written, so the previous complete
  catalogue stays in place. Optional data degrades instead: NUS checkpoints leave Route Distance
  unknown, and the index upload is best effort.
- A successful run exits the process after 5 seconds so its container restarts with the new
  catalogue.
- Protect operator-only routes with `requiresSecret: true` (see `src/routes/alerts/putAnnouncement.ts`).

## Upstream failures

Apps detect Outages per device from their own requests; the server stores none
(`docs/adr/0001-detect-outages-per-device.md`). The app calls LTA directly, so the server's job is
NUS:

- Calls through the Univus bus proxy (`src/fetchers/univus-bus-proxy-fetcher.ts`) throw
  `UpstreamError` (`src/utils/upstream-error.ts`), with `timedOut` set from `isTimeoutError`.
- Routes map `UpstreamError` to 504 when timed out (never an Outage) and 502 otherwise, and keep
  500 for the server's own failures. Canonical example: `src/routes/univus/getNUSBusArrivals.ts`.
- Optional Arrival Enrichment falls back to an empty value instead of failing the arrival.

## Route Distance Index

`generateJSON` ends by publishing the index to Firebase Storage, best effort
(`docs/adr/0002-publish-route-distance-index-to-firebase-storage.md`, `README.md` for env vars).
Run local generation with `ENV=dev`, which uploads only when `FIREBASE_STORAGE_EMULATOR_HOST` is
set; without `ENV=dev`, any Google credentials on the machine upload to the production bucket. A
change to the index shape needs a new object path (`v2`).

## Deployment

- Production: pushes to `main` build and push the GCP image from `docker-compose.yml`, then reset
  the GCE VM, whose `startup.sh` runs it. `docker-compose.yml` is CI's file only.
- Beta: `docker-compose.beta.yml` on relic-01, behind a Cloudflare Tunnel at
  `beta-transito-api.tnitish.com`.
