# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-10

### Added

- `Auth` — the root-export `@roastery/blend` capsule manifest declaring the `environmentNeeds` (`AuthEnvDependenciesDTO`), the `authController` plugin, and capsule dependencies on `@roastery-adapters/cache` (0.1.0) and `@roastery-capsules/jwt` (0.0.1).
- `IGNORE_AUTH` — optional boolean environment variable that turns the `auth` guard into a no-op (auth bypass for development).
- Dependency-injection contract: `authController` and `auth` now read `env`, `cache`, and `jwt` from the barista instance's decorators, throwing `MissingPluginDependencyException` / `InvalidEnvironmentException` at registration time when they are missing.
- Unit test suite (bun:test) covering utils, controller, guard, and the manifest; TSDoc documentation across the public API in `src/`.
- `README.md` rewritten to document the current API (dependency-injection contract, `Auth` capsule manifest, current subpaths, current environment variables) instead of the pre-rebrand one.

### Changed

- **Breaking:** renamed `GetAccessController` → `authController` and `baristaAuth` → `auth`; the guard no longer accepts `IAuthOptions` (`cacheProvider`/`redisUrl`) — providers are injected instead.
- Exception layer identifier in the plugins: `"auth@login"` → `"@roastery::capsules:auth"`.
- `ACCESS_TOKEN` cookie: `maxAge` now comes from `CACHE_EXPIRATION_TIME.SAFE` (`@roastery/pantry`) instead of a hard-coded 3600.
- Route error responses are documented via `baristaResponse` (`@roastery/pantry`) instead of local error DTOs.
- Dependencies: upgraded `@roastery-adapters/cache` ^0.1.0, `@roastery/barista` ^0.1.1, `@roastery/beans` ^0.1.2, and `@roastery/terroir` ^0.1.0; added `@roastery-capsules/jwt`, `@roastery/blend`, and `@roastery/pantry`; Biome schema 2.4.6 → 2.4.16; `.gitignore` now ignores `.env.*`.

### Removed

- **Breaking:** internal `JWT` model (`src/models/`, jose-based) and the `/models` subpath — JWT signing/verification is now delegated to the injected `@roastery-capsules/jwt`; the `jose` dependency was removed.
- **Breaking:** the `/dtos/errors` subpath (BadRequest/BadResponse/DatabaseUnavailable/ErrorType/ResourceNotFound/Unauthorized DTOs) — replaced by `baristaResponse`.
- **Breaking:** `JWT_SECRET`, `CACHE_PROVIDER`, and `REDIS_URL` removed from `AuthEnvDependenciesDTO`.
- `@roastery/seedbed` dependency (replaced by `@roastery/pantry`).

[0.1.0]: https://github.com/roastery-cms/capsules-auth/releases/tag/v0.1.0
