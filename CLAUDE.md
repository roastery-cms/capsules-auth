# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@roastery-capsules/auth` is the authentication capsule for the Roastery CMS ecosystem: a single-credential login endpoint with rate limiting, revocable session access keys stored in cache, and a route-protection guard — packaged as a Blend capsule for Barista (Elysia-based) apps.

**`README.md` is stale after the `@roastery-capsules` rebrand/refactor.** It still documents a `JWT` model class (`src/models/` was deleted — JWT is now the injected `@roastery-capsules/jwt`), a `dtos/errors` subpath (deleted), a guard named `baristaAuth` with `cacheProvider`/`redisUrl` options (the actual export is `auth`; the cache is injected), and `CACHE_PROVIDER`/`REDIS_URL` env vars (removed). Trust the source, not the README.

This repo lives under `~/Documents/roastery-cms`, which is **not** a monorepo/workspace — each subdirectory is an independent git repo published to npm (`@roastery/*`, `@roastery-capsules/*`, `@roastery-adapters/*`). Cross-package local development uses `bun link` (`bun run setup`).

## Tooling

Bun is managed by **mise** (`mise.toml` pins `bun = "latest"`). Invoke toolchain binaries through it — the husky hooks do the same:

```bash
mise exec -- bun run test:unit                    # bun test --env-file=.env.testing
mise exec -- bun run test:coverage                # same, with coverage
mise exec -- bun test src/path/file.spec.ts       # single file
mise exec -- bun test --test-name-pattern "<re>"  # filter by it/describe name

mise exec -- bunx tsc --noEmit -p tsconfig.json   # type-check only (dev tsconfig has noEmit: true)
mise exec -- bunx biome check                     # lint (add --fix to write; biome is not in package.json deps)
mise exec -- bun run knip                         # orphan exports/dependencies
mise exec -- bun run build                        # biome check --fix && tsup → dist/ (cjs + esm + dts)
mise exec -- bun run setup                        # build + bun link
```

- Tests use **`bun:test` only**, `.spec.ts` colocated with source; discovery is restricted to `src/` (`bunfig.toml`: `root = "src"`, `serial = true`, `smol = true`). The `.agent/rules/use-vitest.md` rule is vestigial — bun:test is authoritative, consistent with the other Roastery repos.
- **Current gap:** the refactor deleted every `*.spec.ts`, and `.env.testing` (required by `test:unit`/`test:coverage`) does not exist. The pre-commit chain fails until both are restored.
- Husky: `commit-msg` runs commitlint (Conventional Commits); `pre-commit` chains `test:unit` → `test:coverage` → `knip` → `setup`.
- `tsconfig.json` has `strict: true` and `verbatimModuleSyntax: true` — type-only imports must use `import type`. Path aliases: `@/*` → `./src/*`, `t/*` → `./test/*`. `tsconfig.build.json` is what tsup consumes.

## Architecture

The package has two consumption modes:

1. **As a Blend capsule** — the root export `Auth extends Blend` (`src/index.ts`) declares name/version/owner/license, `environmentNeeds = AuthEnvDependenciesDTO`, `plugin = authController`, and capsule dependencies on `@roastery-adapters/cache` and `@roastery-capsules/jwt`.
2. **As granular subpaths** — `package.json` `exports` uses the `./*` wildcard, so every `src/**/index.ts` is a public entry point (`@roastery-capsules/auth/plugins/guards`, `/plugins/controllers`, `/utils`, `/dtos`, `/plugins/tags`).

### Dependency-injection contract (the key cross-file pattern)

Both `authController` (`src/plugins/controllers/get-access.controller.ts`) and the guard `auth` (`src/plugins/guards/auth.guard.ts`) are `(app: Barista) => object` functions that pull collaborators off `app.decorator` — they never construct them:

- `app.decorator.env` → `AuthEnvDependenciesDTO` (`AUTH_EMAIL`, `AUTH_PASSWORD`, optional `IGNORE_AUTH`)
- `app.decorator.cache` → `BaristaCacheInstance` (from `@roastery-adapters/cache/types`)
- `app.decorator.jwt` → `JsonWebToken` (from `@roastery-capsules/jwt`)

The host Barista app must decorate all three **before** mounting; missing pieces throw `MissingPluginDependencyException` / `InvalidEnvironmentException` (`@roastery/terroir/exceptions/infra`). There is no internal JWT implementation — signing/verification is entirely the injected `jwt`. To see the wiring, read the consuming app, not this package.

### Flows

**Login (`POST /auth/login`)** — validates against the single credential pair from env: `LoginAttempt.check` (returns 429 when exhausted) → `verifyCredentials` → on failure `LoginAttempt.fail` + `BadRequestException`; on success `LoginAttempt.success`, mint a UUID access key (`generateUUID` from `@roastery/beans/entity/helpers`), persist it via `AccessKey.set`, and write the `ACCESS_TOKEN` cookie (`jwt.sign({ ACCESS_KEY, EMAIL })`, httpOnly + secure, `maxAge = CACHE_EXPIRATION_TIME.SAFE` from `@roastery/pantry/constants`).

**Guard (`auth`)** — if the `IGNORE_AUTH` env is truthy the guard returns `app` unchanged (auth bypass for local dev). Otherwise a scoped `onBeforeHandle` reads the `ACCESS_TOKEN` cookie, `jwt.verify`s it, and compares the token's `ACCESS_KEY` against the cached one for that `EMAIL` — sessions are revocable by deleting the cache entry, and a new login invalidates older tokens.

**Utils (`src/utils/`)** — `AccessKey`: cache wrapper at `access-key:${email}` with `CACHE_EXPIRATION_TIME.SAFE` TTL, throws `DatabaseUnavailableException` on failure. `LoginAttempt`: rate limiter at `login-attempts:${email}` storing `{attempts, lastUpdate}`; `MAX_ATTEMPTS = 5` with lazy recovery (1 attempt/hour, recomputed on read). `verifyCredentials`: `Schema.make(VerifyCredentialsDTO).match` + credential comparison.

Cross-cutting idioms: controller/guard expose `authAccessKey`/`authLoginAttempt` via `.derive({ as: "scoped" })`; OpenAPI response schemas are declared with `baristaResponse(...)` (`@roastery/pantry/presentation/utils`) referencing terroir exception names; the OpenAPI tag metadata lives in `src/plugins/tags`.

## Conventions

- Exception constructors take the capsule identifier `"@roastery::capsules:auth"` as the first argument.
- Don't use `any` (rule `.agent/rules/dont-use-any-type.md`). Biome config: tab indentation, double quotes, `organizeImports` off, `noNonNullAssertion` off (the code uses `!` on cookies deliberately).
- `.agent/` is a git submodule (Caffeine.js Agent Guide) with shared rules and workflows (`smart-commit`, layered reviews). Rules that reference `@caffeine/*` packages or vitest map to the `@roastery/*` equivalents and bun:test in this repo.
