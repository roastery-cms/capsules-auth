# @roastery-capsules/auth

Authentication and session management capsule for the [Roastery CMS](https://github.com/roastery-cms) ecosystem.

[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

## Overview

**auth** provides secure authentication primitives for Roastery CMS applications:

- **JWT tokens** — Signing and verification using HS256 via [jose](https://github.com/panva/jose), with automatic expiration.
- **Login endpoint** — A ready-to-use controller that validates credentials, issues secure HTTP-only cookies, and enforces rate limiting.
- **Auth guard** — Middleware that protects routes by verifying JWT tokens and session access keys.
- **Rate limiting** — Progressive login attempt tracking with automatic recovery.

## Technologies

| Tool | Purpose |
|------|---------|
| [jose](https://github.com/panva/jose) | JWT signing and verification (HS256) |
| [@roastery-adapters/cache](https://github.com/roastery-cms/adapters-cache) | Cache abstraction for access keys and attempt tracking |
| [@roastery/barista](https://github.com/roastery-cms/barista) | Web framework (Elysia-based) for controllers and guards |
| [@roastery/terroir](https://github.com/roastery-cms/terroir) | Exception hierarchy and runtime schema validation |
| [tsup](https://tsup.egoist.dev) | Bundling to ESM + CJS with `.d.ts` generation |
| [Bun](https://bun.sh) | Runtime, test runner, and package manager |
| [Knip](https://knip.dev) | Unused exports and dependency detection |
| [Husky](https://typicode.github.io/husky) + [commitlint](https://commitlint.js.org) | Git hooks and conventional commit enforcement |

## Installation

```bash
bun add @roastery-capsules/auth
```

---

## Login Controller

The `GetAccessController` exposes a `POST /auth/login` endpoint that handles the full authentication flow.

```typescript
import { GetAccessController } from '@roastery-capsules/auth/plugins/controllers';

app.use(GetAccessController({ /* env dependencies */ }));
```

**Flow:**

1. Validates email and password against configured credentials
2. Checks rate limit (max 5 attempts, 1 hour recovery per attempt)
3. Generates a unique access key and stores it in cache
4. Signs a JWT containing `ACCESS_KEY` and `EMAIL`
5. Returns the token in a secure HTTP-only cookie (`ACCESS_TOKEN`)

**Response codes:**

| Status | Meaning |
|--------|---------|
| 200 | Login successful |
| 400 | Invalid credentials |
| 429 | Too many attempts |
| 503 | Cache unavailable |

---

## Auth Guard

The `baristaAuth` guard protects routes by verifying JWT tokens and validating session access keys.

```typescript
import { baristaAuth } from '@roastery-capsules/auth/plugins/guards';

app.use(
  baristaAuth({
    layerName: 'MyController',
    jwtSecret: process.env.JWT_SECRET,
    cacheProvider: 'REDIS',
    redisUrl: process.env.REDIS_URL,
  })
);
```

**On each request:**

1. Extracts JWT from `ACCESS_TOKEN` cookie
2. Verifies signature and expiration
3. Validates access key against stored value in cache
4. Throws `UnauthorizedException` on failure

---

## JWT Model

```typescript
import { JWT } from '@roastery-capsules/auth/models';

const jwt = new JWT(secret);

// Sign a payload (expires in 1 hour)
const token = await jwt.sign({ email: 'user@example.com' });

// Verify and decode
const payload = await jwt.verify<{ email: string }>(token);
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `AUTH_EMAIL` | Yes | Configured authentication email |
| `AUTH_PASSWORD` | Yes | Configured authentication password |
| `CACHE_PROVIDER` | Yes | `"REDIS"` or `"MEMORY"` |
| `REDIS_URL` | If Redis | Redis connection URL |

---

## Exports Reference

```typescript
import { ... } from '@roastery-capsules/auth/plugins/controllers'; // GetAccessController
import { ... } from '@roastery-capsules/auth/plugins/guards';      // baristaAuth
import { ... } from '@roastery-capsules/auth/models';              // JWT
import { ... } from '@roastery-capsules/auth/utils';               // AccessKey, LoginAttempt, verifyCredentials
import { ... } from '@roastery-capsules/auth/dtos';                // AuthEnvDependenciesDTO, VerifyCredentialsDTO
import { ... } from '@roastery-capsules/auth/dtos/errors';         // Error DTOs for OpenAPI schemas
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
