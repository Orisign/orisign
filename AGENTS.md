# Code Cleanup Agent Instructions

## Goal

Refactor the entire codebase to improve readability, eliminate duplication, and remove dead weight. No new features. No behavior changes. Just clean code.

---

## Rules

### 1. Extract Repeated Logic into Functions

- If the same block of code (3+ lines) appears more than once — extract it into a named function.
- Place shared functions in a logical shared/utils file, or near the code that owns it.
- The function name must clearly describe what it does (verb + noun): `getUserById`, `formatDate`, `buildQuery`.
- Do not create a function for a one-liner unless it's used 3+ times.

### 2. Simplify Variable Names

- One word is ideal. Two words max. Three words is almost always wrong.
- Use domain language, not implementation language:
  - ❌ `userDataResponseObject`, `tempIterationCounter`, `fetchedResultsArray`
  - ✅ `user`, `count`, `results`
- Loop variables: `i`, `j` are fine for simple loops. For meaningful loops use the item name: `for (const user of users)`.
- Boolean variables must read like a question: `isLoading`, `hasError`, `canSubmit`.
- Avoid abbreviations unless they're universal (`id`, `url`, `db`, `ctx`, `err`).

### 3. Clean Up Dead Code

- Delete commented-out code blocks. Git history exists for a reason.
- Delete unused variables, unused imports, unused functions.
- Delete console.log / print / debug statements left from development.
- Delete TODO comments older than the current sprint (or flag them clearly with `// TODO(owner): description`).

### 4. Flatten Nesting

- If a function has more than 3 levels of nesting — refactor it.
- Use early returns (guard clauses) instead of deeply nested if-else:
  ```
  // ❌ bad
  if (user) {
    if (user.active) {
      doSomething()
    }
  }

  // ✅ good
  if (!user || !user.active) return
  doSomething()
  ```

### 5. One Function, One Job

- If a function does more than one thing — split it.
- Max ~30 lines per function. If it's longer, it probably does too much.
- Side effects must be isolated from pure logic.

### 6. Consistent Formatting

- Apply the project's existing formatter (Prettier, Black, gofmt, etc.) to every file you touch.
- If no formatter is configured — do not invent one. Flag it in the summary.

---

## Constraints

- **Do not change behavior.** If a refactor risks changing logic — leave it and add a comment `// REVIEW: possible refactor`.
- **Do not rename public API functions or exported symbols** without explicit instruction.
- **Do not add new dependencies.**
- **Do not touch generated files** (anything in `dist/`, `build/`, `__generated__/`, `.pb.go`, etc.).
- Work file by file, or module by module. Do not rewrite the whole project in one shot.

---

## Output Format

For each file you modify, provide:

```
### `path/to/file.ts`

**Changes:**
- Extracted `doX` and `doY` into shared `helpers.ts`
- Renamed `tempDataResponseObj` → `data`
- Removed 2 unused imports
- Deleted commented-out block (lines 45–60)
- Flattened nested if in `processOrder()`
```

If a file has no issues — skip it. Do not list files that required no changes.

---

## Priority Order

1. Files with the most duplication first.
2. Then files with the longest functions.
3. Then files with the most complex variable names.
4. Then dead code cleanup across the board.

---

## Done Criteria

The cleanup is complete when:

- No block of 3+ lines is copy-pasted more than once.
- No variable name exceeds two words (except established domain terms).
- No commented-out code remains.
- No unused imports or variables remain.
- All functions have a single clear responsibility.

---

## Workflows & Commands

Monorepo managed with [Turborepo](./turbo.json) and Bun (`packageManager: bun@1.2.10`). Workspaces: `apps/*`, `packages/*`.

### Root scripts (from `package.json`)

- `bun run build` — Turbo build across all workspaces.
- `bun run dev` — Turbo dev across all workspaces (concurrency 15).
- `bun run lint` — Turbo lint across all workspaces.
- `bun run db:push` — `prisma db push` for every service that owns a schema (auth, conversation, handle, message, users, bot).
- `bun run db:generate` — `prisma generate` for the same set of services.
- `bun run db:sync` — runs `db:push` then `db:generate`.

### Per-service scripts (NestJS apps)

Most services under `apps/*` (auth, conversation, handle, message, users, gateway, notification, call, bot) share this layout:

- `bun run --filter <service> dev` — `nest start --watch`.
- `bun run --filter <service> build` — `nest build`.
- `bun run --filter <service> start:prod` — `node dist/main`.
- `bun run --filter <service> lint` — ESLint with `--fix`.
- `bun run --filter <service> test` / `test:watch` / `test:cov` / `test:e2e` — Jest (e2e config: `test/jest-e2e.json`).
- `bun run --filter <service> format` — Prettier on `src/**/*.ts` and `test/**/*.ts` (where defined).
- `bun run --filter <service> prisma:push` / `prisma:generate` — Prisma using `prisma.config.ts` (services with a schema only).

Service-specific entry points:

- `bot-service` exposes additional dev entries: `dev:dispatcher` (`main.dispatcher`) and `dev:delivery` (`main.delivery`).
- `media-service` is a Go service (`apps/media-service/main.go`). Its `package.json` scripts shell out to Windows `dev.cmd` / `build.cmd`, which just set `GOCACHE`/`GOPATH` and call `go run main.go` / `go build -o dist/media-service main.go`. On non-Windows hosts run those `go` commands directly — TODO: add cross-platform npm scripts.

### Web app (`apps/web`, Next.js)

- `bun run --filter web dev` — `next dev`.
- `bun run --filter web build` — `next build`.
- `bun run --filter web start` — `next start`.
- `bun run --filter web lint` — `eslint`.
- `bun run --filter web pull:api` — runs `scripts/pull-api.mjs` (fetches OpenAPI specs).
- `bun run --filter web generate:api` — `pull:api` then `orval` codegen using `orval.config.ts`.

### Local infrastructure

`docker/docker-compose.yml` provides Postgres (5433→5432), Redis (6379), and RabbitMQ (with management). Bring it up with:

```
docker compose -f docker/docker-compose.yml up -d
```

Required env vars referenced by the compose file: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (plus any RabbitMQ vars defined further down). TODO: document the canonical `.env` location once confirmed.

### Workspace packages

- `packages/common` (`@repo/common`) — `bun run --filter @repo/common build` (`tsc -p tsconfig.build.json`), `format` (Prettier on `src/**/*.ts`). No lint/test scripts defined.
- `packages/contracts` (`@repo/contracts`) — `build` runs both `tsconfig.build.json` and `tsconfig.gen.json`; `build:gen` runs only the generated-code tsconfig. `generate` invokes `protoc` over `packages/contracts/proto/*.proto` with `ts-proto` (`nestJs=true,package=omit,stringEnums=true`) into `gen/ts`, then runs `build:gen`. Requires `protoc` on `PATH`.
- `packages/ui` (`@repo/ui`) — `bun run --filter @repo/ui lint` (`eslint . --max-warnings 0`), `storybook` (`storybook dev -p 6006`), `build-storybook`. No build script — package is consumed directly from `src/`.
- `packages/bot-sdk` (`@orisign/bot-sdk`) — `bun run --filter @orisign/bot-sdk build` (`tsc -p tsconfig.json`) and `test` (`bun test`).

### Other surfaces

- `sdks/python/orisign-bot-sdk` — Python SDK (`pyproject.toml`, setuptools build). Runtime deps: `httpx`, `pydantic`. Optional extras: `webhook` (`fastapi`), `dev` (`pytest`, `pytest-asyncio`). Install for development with `pip install -e '.[dev,webhook]'` and run tests with `pytest` from the package dir. TODO: confirm canonical Python version / virtualenv setup.