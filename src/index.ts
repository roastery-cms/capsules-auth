/**
 * Authentication capsule for the Roastery CMS ecosystem.
 *
 * @remarks
 * Provides a rate-limited, single-credential login endpoint
 * (`POST /auth/login`), revocable session access keys persisted in cache, and
 * a route-protection guard for Barista (Elysia-based) applications. Signing
 * and verification are delegated entirely to the injected
 * `@roastery-capsules/jwt`, and persistence to the injected
 * `@roastery-adapters/cache` — this package ships no implementation of either.
 *
 * @packageDocumentation
 */
import {
	Blend,
	type Owner,
	type Plugin,
	type Tag,
	type Version,
} from "@roastery/blend";
import { AuthEnvDependenciesDTO } from "./dtos";
import type { t } from "@roastery/terroir";
import { authController } from "./plugins/controllers";
import AuthTags from "./plugins/tags";

/**
 * Capsule manifest for `@roastery-capsules/auth`.
 *
 * @remarks
 * Declarative identity card read by the `@roastery/blend` orchestration.
 * Consuming applications register this class (not the plugin directly) so the
 * platform can validate {@link environmentNeeds} and the declared
 * {@link dependencies} before mounting {@link plugin} on a Barista instance.
 * The host must decorate `env`, `cache`, and `jwt` **before** the plugin is
 * mounted — the capsule constructs none of them.
 *
 * @example
 * ```ts
 * import { Auth } from "@roastery-capsules/auth";
 *
 * const capsule = new Auth();
 * app.use(capsule.plugin);
 * ```
 *
 * @see {@link authController} — the Barista plugin this capsule mounts
 * @see {@link AuthEnvDependenciesDTO} — the environment contract it enforces
 */
export class Auth extends Blend {
	/** Package name published to npm, used as the capsule identifier. */
	override name = "@roastery-capsules/auth";
	/** Capsule version enforced by the Blend orchestration. */
	override version: Version = "0.1.0";
	/** Maintainer contact and source repository metadata. */
	override owner: Owner = {
		name: "Alan Reis Anjos",
		email: "alanreisanjo@gmail.com",
		repository: "https://github.com/roastery-cms/capsules-auth",
	};
	/** SPDX license identifier. */
	override license: string = "MIT";
	/** Requires `AUTH_EMAIL` and `AUTH_PASSWORD` (optionally `IGNORE_AUTH`). @see {@link AuthEnvDependenciesDTO} */
	override environmentNeeds?: t.TSchema | undefined = AuthEnvDependenciesDTO;
	/** Mounts the `POST /auth/login` endpoint. @see {@link authController} */
	override plugin: Plugin = authController;
	/** Requires `@roastery-adapters/cache` 0.1.0 and `@roastery-capsules/jwt` 0.0.1 registered by the host. */
	override dependencies: Record<string, Version> = {
		"@roastery-adapters/cache": "0.1.0",
		"@roastery-capsules/jwt": "0.0.1",
	};

	override tag?: Tag | undefined = AuthTags;
}
