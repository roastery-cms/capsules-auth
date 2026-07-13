# @roastery-capsules/auth

Authentication and session management capsule for the [Roastery CMS](https://github.com/roastery-cms) ecosystem.

[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

## Overview

**auth** provides a single-credential login endpoint, revocable session access keys, and a route-protection guard, packaged as a [Blend](https://github.com/roastery-cms/blend) capsule for [Barista](https://github.com/roastery-cms/barista) (Elysia-based) apps:

- **Login endpoint** — `POST /auth/login`, rate-limited, issues a secure HTTP-only session cookie.
- **Auth guard** — protects routes by verifying the session cookie against a revocable, cached access key.
- **Rate limiting** — progressive login attempt tracking with lazy, automatic recovery.
- **No bundled infrastructure** — JWT signing/verification and cache persistence are entirely delegated to injected capsules; this package ships no implementation of either.

## Technologies

| Tool | Purpose |
|------|---------|
| [@roastery-capsules/jwt](https://github.com/roastery-cms/capsules-jwt) | Injected JWT signing and verification |
| [@roastery-adapters/cache](https://github.com/roastery-cms/adapters-cache) | Injected cache abstraction for access keys and attempt tracking |
| [@roastery/barista](https://github.com/roastery-cms/barista) | Web framework (Elysia-based) for controllers and guards |
| [@roastery/blend](https://github.com/roastery-cms/blend) | Capsule packaging and dependency manifest |
| [@roastery/terroir](https://github.com/roastery-cms/terroir) | Exception hierarchy and runtime schema validation |
| [@roastery/pantry](https://github.com/roastery-cms/pantry) | Shared constants and OpenAPI response helpers |
| [tsup](https://tsup.egoist.dev) | Bundling to ESM + CJS with `.d.ts` generation |
| [Bun](https://bun.sh) | Runtime, test runner, and package manager |
| [Knip](https://knip.dev) | Unused exports and dependency detection |
| [Husky](https://typicode.github.io/husky) + [commitlint](https://commitlint.js.org) | Git hooks and conventional commit enforcement |

## Installation

```bash
bun add @roastery-capsules/auth
```

---

## Consumption modes

This package can be consumed in two ways:

**As a Blend capsule** — register the `Auth` manifest and let the platform validate its environment and dependencies before mounting it:

```typescript
import { Auth } from '@roastery-capsules/auth';

const capsule = new Auth();
app.use(capsule.plugin);
```

**As granular subpaths** — import only what you need:

```typescript
import { authController } from '@roastery-capsules/auth/plugins/controllers';
import { auth } from '@roastery-capsules/auth/plugins/guards';
import { AccessKey, LoginAttempt, verifyCredentials } from '@roastery-capsules/auth/utils';
import { AuthEnvDependenciesDTO, VerifyCredentialsDTO } from '@roastery-capsules/auth/dtos';
```

---

## Dependency-injection contract

Neither `authController` nor the `auth` guard construct their own collaborators — they read them off the Barista instance's decorators:

| Decorator | Type | Source |
|---|---|---|
| `env` | `AuthEnvDependenciesDTO` | Validated environment (`AUTH_EMAIL`, `AUTH_PASSWORD`, optional `IGNORE_AUTH`) |
| `cache` | `BaristaCacheInstance` | `@roastery-adapters/cache` |
| `jwt` | `JsonWebToken` | `@roastery-capsules/jwt` |

The host application **must decorate all three before mounting** this capsule's plugin or guard:

```typescript
app
  .decorate('env', validatedEnv)
  .decorate('cache', cacheInstance)
  .decorate('jwt', jwtInstance)
  .use(authController)
  .use(auth);
```

Missing pieces throw at registration time: `MissingPluginDependencyException` when `cache`/`jwt` are absent, `InvalidEnvironmentException` when `AUTH_EMAIL`/`AUTH_PASSWORD` are missing from `env`.

---

## Login Controller

`authController` exposes a `POST /auth/login` endpoint that handles the full authentication flow.

```typescript
import { authController } from '@roastery-capsules/auth/plugins/controllers';

app.use(authController);
```

**Flow:**

1. Checks the rate limit (max 5 attempts, lazy recovery of 1 attempt/hour)
2. Validates the request body against the configured `AUTH_EMAIL`/`AUTH_PASSWORD`
3. On failure, consumes one attempt and throws a `BadRequestException`
4. On success, resets the rate limit, mints a UUID access key and stores it in cache
5. Signs a JWT containing `{ ACCESS_KEY, EMAIL }` and returns it in a secure, HTTP-only `ACCESS_TOKEN` cookie

**Response codes:**

| Status | Meaning |
|--------|---------|
| 200 | Login successful |
| 400 | Invalid credentials |
| 429 | Too many attempts |
| 503 | Cache unavailable |

---

## Auth Guard

`auth` protects routes by verifying the `ACCESS_TOKEN` cookie against the cached session access key.

```typescript
import { auth } from '@roastery-capsules/auth/plugins/guards';

app.use(auth);
```

**On each request:**

1. Reads and `jwt.verify`s the `ACCESS_TOKEN` cookie
2. Compares the token's `ACCESS_KEY` against the cached value for that `EMAIL`
3. Throws `UnauthorizedException` (missing/invalid cookie or key mismatch) or `ResourceNotFoundException` (missing `EMAIL` in the token payload) on failure

Sessions are revocable: deleting the cache entry — or simply logging in again, which overwrites it — invalidates any previously issued token. Setting `IGNORE_AUTH` truthy in the environment turns the guard into a no-op, for local development only.

---

## Utils

| Export | Purpose |
|---|---|
| `AccessKey` | Cache wrapper for the session access key of an e-mail (`access-key:<email>`, TTL `CACHE_EXPIRATION_TIME.SAFE`) |
| `LoginAttempt` | Rate limiter (`login-attempts:<email>`), max 5 attempts with lazy recovery of 1/hour |
| `verifyCredentials` | Validates a login payload's shape and compares it against the configured credential pair |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_EMAIL` | Yes | Configured authentication email |
| `AUTH_PASSWORD` | Yes | Configured authentication password |
| `IGNORE_AUTH` | No | When truthy, disables the `auth` guard entirely (development only). Default `false` |

`CACHE_PROVIDER`/`REDIS_URL` and any JWT signing secret are required by the injected `@roastery-adapters/cache` and `@roastery-capsules/jwt` dependencies, not by this capsule directly.

---

## Exports Reference

```typescript
import { Auth } from '@roastery-capsules/auth';                              // Blend capsule manifest
import { authController } from '@roastery-capsules/auth/plugins/controllers'; // POST /auth/login
import { auth } from '@roastery-capsules/auth/plugins/guards';                // Route-protection guard
import AuthTags from '@roastery-capsules/auth/plugins/tags';                  // OpenAPI tag metadata
import { AccessKey, LoginAttempt, verifyCredentials } from '@roastery-capsules/auth/utils';
import { AuthEnvDependenciesDTO, VerifyCredentialsDTO } from '@roastery-capsules/auth/dtos';
```

---

## Development

```bash
# Run tests
bun run test:unit

# Run tests with coverage
bun run test:coverage

# Build for distribution
bun run build

# Check for unused exports and dependencies
bun run knip

# Full setup (build + bun link)
bun run setup
```

## License

MIT
