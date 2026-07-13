import { UnauthorizedException } from "@roastery/terroir/exceptions/application";
import {
	MissingPluginDependencyException,
	ResourceNotFoundException,
} from "@roastery/terroir/exceptions/infra";
import { AccessKey } from "@/utils/access-key";
import type { Barista } from "@roastery/barista";
import type { t } from "@roastery/terroir";
import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";
import type { JsonWebToken } from "@roastery-capsules/jwt";
import { baristaResponse } from "@roastery/pantry/presentation/utils";
import type { AuthEnvDependenciesDTO } from "@/dtos";

/**
 * Barista guard protecting routes behind the `ACCESS_TOKEN` cookie.
 *
 * @remarks
 * Like {@link authController}, the guard never constructs its collaborators
 * — it pulls them off `app.decorator`: `env` ({@link AuthEnvDependenciesDTO}),
 * `cache` ({@link BaristaCacheInstance}), and `jwt` ({@link JsonWebToken}). The
 * host application must decorate all three **before** mounting this guard.
 *
 * When `env.IGNORE_AUTH` is truthy the guard returns the app unchanged — a
 * full protection bypass meant for local development only.
 *
 * Otherwise, a scoped `onBeforeHandle` runs on every guarded request:
 * 1. the `ACCESS_TOKEN` cookie must be present and hold a string, or an
 *    {@link UnauthorizedException} is thrown;
 * 2. its value is `jwt.verify`d into an `{ ACCESS_KEY, EMAIL }` payload;
 * 3. a missing `EMAIL` throws a {@link ResourceNotFoundException};
 * 4. the token's `ACCESS_KEY` is compared against {@link AccessKey.get} for
 *    that `EMAIL` — a missing or mismatched key throws an
 *    {@link UnauthorizedException}. Because {@link AccessKey.set} overwrites
 *    the cached key on every login, a session is revoked simply by logging
 *    in again elsewhere, or by deleting the cache entry outright.
 *
 * @example
 * ```ts
 * import { auth } from "@roastery-capsules/auth/plugins/guards";
 *
 * app
 *   .decorate("env", validatedEnv)
 *   .decorate("cache", cacheInstance)
 *   .decorate("jwt", jwtInstance)
 *   .use(auth);
 * ```
 *
 * @typeParam ContentType - Content schemas carried by the host Barista
 *   instance.
 * @typeParam BasePath - Base path the host Barista instance is mounted on.
 * @param app - Host Barista instance, already decorated with `env`, `cache`,
 *   and `jwt`.
 * @returns The app unchanged when `IGNORE_AUTH` is set; otherwise the app
 *   extended with a scoped `authAccessKey` derivation and the
 *   `onBeforeHandle` check.
 * @throws {@link MissingPluginDependencyException} at registration when `jwt`
 *   or `cache` is missing from the decorator.
 */
export function auth<
	const ContentType extends t.TObject[] = [],
	const BasePath extends string = "",
>(app: Barista<ContentType, BasePath>): object {
	const { IGNORE_AUTH } = app.decorator
		.env as unknown as AuthEnvDependenciesDTO;

	const { cache, jwt } = app.decorator as unknown as {
		cache: BaristaCacheInstance;
		jwt: JsonWebToken;
	};

	if (!jwt)
		throw new MissingPluginDependencyException(
			"@roastery::capsules:auth",
			"@roastery-capsules/jwt was missing in barista instance",
		);

	if (!cache)
		throw new MissingPluginDependencyException(
			"@roastery::capsules:auth",
			"@roastery-adapters/cache was missing in barista instance",
		);

	if (IGNORE_AUTH) return app;

	return app
		.derive({ as: "scoped" }, () => ({
			authAccessKey: new AccessKey(cache),
		}))
		.guard({
			as: "scoped",
			response: baristaResponse(
				{},
				{
					application: ["BadRequestException", "UnauthorizedException"],
					infra: ["ResourceNotFoundException"],
				},
			),
		})
		.onBeforeHandle(
			{ as: "scoped" },
			async ({ cookie: { ACCESS_TOKEN }, authAccessKey }) => {
				if (!ACCESS_TOKEN || typeof ACCESS_TOKEN.value !== "string")
					throw new UnauthorizedException("@roastery::capsules:auth");

				const value = String(ACCESS_TOKEN.value);

				const {
					payload: { ACCESS_KEY, EMAIL },
				} = await jwt.verify<{
					ACCESS_KEY: string | null;
					EMAIL: string | null;
				}>(value);

				if (!EMAIL)
					throw new ResourceNotFoundException(
						"@roastery::capsules:auth",
						`EMAIL was missing`,
					);

				const currentAccessKey = await authAccessKey.get(EMAIL);

				if (!ACCESS_KEY || ACCESS_KEY !== currentAccessKey)
					throw new UnauthorizedException("@roastery::capsules:auth");
			},
		);
}
