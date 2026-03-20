# AGENTS.md

Broadchurch tenant application built on Aether (Nuxt 3 + Vuetify).

## Quick Start

If you're in Cursor Cloud, **the environment is already set up for you.** Do NOT
manually run `nvm install`, `nvm use`, `node init-project.js`, or `npm install`
-- the `environment.json` install step handles all of this automatically,
including pinning Node 20 via nvm. A dev server terminal starts on port 3000.

**Verify it works:** open `http://localhost:3000` in the browser and confirm you
see the app (not a blank page). If the page is blank, see Known Issues below.

## Cursor Cloud Details

Node 20 is the baseline (`.nvmrc`). The `environment.json` install step handles
this via `nvm install 20 && nvm alias default 20` -- do not switch Node versions
manually. Newer Node versions (22, 25, etc.) generally work but may produce
`EBADENGINE` warnings during install — these are safe to ignore.

The install step also runs `node init-project.js --local` (creates `.env` if
absent) then `npm install` (which triggers `postinstall` -> `nuxt prepare` +
orval codegen). Auth0 is bypassed via `NUXT_PUBLIC_USER_NAME=dev-user` in the
generated `.env`.

**No automated test suite.** Verification is `npm run build` (compile check) and
`npm run format:check` (Prettier). See Verification Commands below.

**Before committing:** always run `npm run format` -- the husky pre-commit hook
runs `lint-staged` with `prettier --check` and will reject unformatted files.

## Manual / Local Setup

Node 20 is the baseline (pinned in `.nvmrc`). Newer versions generally work.

```bash
npm run init -- --local   # creates .env with dev defaults (no Auth0)
npm install               # all deps are public on npmjs.com -- no tokens needed
npm run dev               # dev server on port 3000
```

For the full interactive wizard (project name, Auth0, query server, etc.):

```bash
npm run init              # interactive, or --non-interactive for CI (see --help)
```

## .env Essentials

| Variable                           | Purpose                          | Default                                 |
| ---------------------------------- | -------------------------------- | --------------------------------------- |
| `NUXT_PUBLIC_APP_ID`               | Unique app identifier            | derived from directory name             |
| `NUXT_PUBLIC_APP_NAME`             | Display name                     | derived from directory name             |
| `NUXT_PUBLIC_USER_NAME`            | Set to any value to bypass Auth0 | `dev-user` in local mode                |
| `NUXT_PUBLIC_QUERY_SERVER_ADDRESS` | Query Server URL                 | read from `broadchurch.yaml` if present |
| `NUXT_PUBLIC_GATEWAY_URL`          | Portal Gateway for agent chat    | read from `broadchurch.yaml` if present |
| `NUXT_PUBLIC_TENANT_ORG_ID`        | Auth0 org ID for this tenant     | read from `broadchurch.yaml` if present |

See `.env.example` for the full list.

## Project Structure

| Directory      | Contents                                             | Deployed to            |
| -------------- | ---------------------------------------------------- | ---------------------- |
| `pages/`       | Nuxt pages (file-based routing)                      | Vercel (with app)      |
| `components/`  | Vue components                                       | Vercel (with app)      |
| `composables/` | Vue composables (auto-imported by Nuxt)              | Vercel (with app)      |
| `utils/`       | Utility functions (NOT auto-imported)                | Vercel (with app)      |
| `server/`      | Nitro API routes (KV storage, avatar proxy)          | Vercel (with app)      |
| `agents/`      | Python ADK agents (each subdirectory is deployable)  | Vertex AI Agent Engine |
| `mcp-servers/` | Python MCP servers (each subdirectory is deployable) | Cloud Run              |

### Directories populated by `npm install`

`skills/elemental-api/` contains API skill documentation (endpoint reference,
types, usage patterns). These files are copied from the
`@yottagraph-app/elemental-api-skill` npm package during the `postinstall`
step. **The directory will be empty until you run `npm install`.** If you're
exploring the project before installing dependencies, the skill docs won't be
there yet — this is expected.

### Agents

`agents/example_agent/` is a working starter agent that queries the Elemental
Knowledge Graph. It includes schema discovery, entity search, property lookup,
and optional MCP server integration. Use it as a starting point — customize the
instruction, add tools, and see the `agents` cursor rule for the full guide.

## Configuration

`broadchurch.yaml` contains tenant-specific settings (GCP project, org ID,
service account, gateway URL, query server URL). It's generated during
provisioning and committed by the `tenant-init` workflow. Don't edit manually
unless you know what you're doing.

## Storage

Each project gets storage services provisioned automatically by the Broadchurch
platform and connected via Vercel env vars:

### KV Store (Upstash Redis) -- always available

Key-value storage for preferences, sessions, caching, and lightweight data.

| Env var             | Purpose                 |
| ------------------- | ----------------------- |
| `KV_REST_API_URL`   | Redis REST API endpoint |
| `KV_REST_API_TOKEN` | Auth token              |

**Server-side** (`server/` routes): use `@upstash/redis` via `server/utils/redis.ts`.
**Client-side** (composables): use `usePrefsStore()` which calls `/api/kv/*` routes.
See the `pref` cursor rule for the `Pref<T>` pattern.

### PostgreSQL (Supabase) -- optional

Full relational database for structured data. Added during project creation
(optional checkbox) or post-creation from the Broadchurch Portal dashboard.

| Env var                         | Purpose                           | Client-safe? |
| ------------------------------- | --------------------------------- | ------------ |
| `NUXT_PUBLIC_SUPABASE_URL`      | Supabase project URL              | Yes          |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key                   | Yes          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only service role key      | **No**       |
| `SUPABASE_DB_URL`               | Direct Postgres connection string | **No**       |

Install `@supabase/supabase-js` to use. See the `server` cursor rule for examples.

## How Deployment Works

### App (Nuxt UI + server routes)

Vercel auto-deploys on every push to `main`. Preview deployments are created for
other branches. The app is available at `{slug}.yottagraph.app`.

### Agents (`agents/`)

Each subdirectory in `agents/` is a self-contained Python ADK agent. Deploy via
the Portal UI or `/deploy_agent` in Cursor.

### MCP Servers (`mcp-servers/`)

Each subdirectory in `mcp-servers/` is a Python FastMCP server. Deploy via
the Portal UI or `/deploy_mcp` in Cursor.

## Verification Commands

```bash
npm run dev          # dev server -- check browser at localhost:3000
npm run build        # production build -- catches compile errors
npm run format       # Prettier formatting (run before committing)
```

## Known Issues

### Blank white page after `npm run dev`

If the server returns HTTP 200 but the page is blank, check the browser console
for `SyntaxError` about missing exports. This is caused by Nuxt's auto-import
scanner. **Fix:** verify the `imports:dirs` hook in `nuxt.config.ts` is present.

### Port 3000 conflict

The dev server binds to port 3000 by default. If another service is already
using that port, start with `PORT=3001 npm run dev`.

### Formatting

Pre-commit hook runs `lint-staged` with Prettier. Run `npm run format` before
committing to avoid failures.
