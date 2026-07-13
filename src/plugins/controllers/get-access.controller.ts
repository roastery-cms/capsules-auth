import { generateUUID } from "@roastery/beans/entity/helpers";
import { t } from "@roastery/terroir";
import { BadRequestException } from "@roastery/terroir/exceptions/application";
import { type AuthEnvDependenciesDTO, VerifyCredentialsDTO } from "@/dtos";
import { AccessKey, LoginAttempt, verifyCredentials } from "@/utils";
import type { Barista } from "@roastery/barista";
import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";
import type { JsonWebToken } from "@roastery-capsules/jwt";
import { CACHE_EXPIRATION_TIME } from "@roastery/pantry/constants";
import { baristaResponse } from "@roastery/pantry/presentation/utils";
import {
	InvalidEnvironmentException,
	MissingPluginDependencyException,
} from "@roastery/terroir/exceptions/infra";

/**
 * Barista plugin exposing the rate-limited `POST /auth/login` endpoint.
 *
 * @remarks
 * The controller never constructs its collaborators — it pulls them off
 * `app.decorator`: `env` ({@link AuthEnvDependenciesDTO}), `cache`
 * ({@link BaristaCacheInstance}), and `jwt` ({@link JsonWebToken}). The host
 * application must decorate all three **before** mounting this plugin.
 *
 * Login flow:
 * 1. {@link LoginAttempt.check} — replies `429` when attempts are exhausted;
 * 2. {@link verifyCredentials} compares the body against `AUTH_EMAIL` /
 *    `AUTH_PASSWORD`;
 * 3. on failure, {@link LoginAttempt.fail} consumes one attempt and a
 *    {@link BadRequestException} is thrown;
 * 4. on success, {@link LoginAttempt.success} resets the counter, a fresh
 *    UUID access key is persisted via {@link AccessKey.set} — revoking any
 *    previous session — and the `ACCESS_TOKEN` cookie is written with the
 *    signed `{ ACCESS_KEY, EMAIL }` payload: `httpOnly`, `secure`,
 *    `path: "/"`, and `maxAge` of {@link CACHE_EXPIRATION_TIME}.SAFE.
 *
 * @example
 * ```ts
 * import { authController } from "@roastery-capsules/auth/plugins/controllers";
 *
 * app
 *   .decorate("env", validatedEnv)
 *   .decorate("cache", cacheInstance)
 *   .decorate("jwt", jwtInstance)
 *   .use(authController);
 * ```
 *
 * @typeParam ContentType - Content schemas carried by the host Barista
 *   instance.
 * @typeParam BasePath - Base path the host Barista instance is mounted on.
 * @param app - Host Barista instance, already decorated with `env`, `cache`,
 *   and `jwt`.
 * @returns The app extended with scoped `authAccessKey` / `authLoginAttempt`
 *   derivations and the login route.
 * @throws {@link MissingPluginDependencyException} at registration when `jwt`
 *   or `cache` is missing from the decorator.
 * @throws {@link InvalidEnvironmentException} at registration when
 *   `AUTH_EMAIL` or `AUTH_PASSWORD` is absent from the environment.
 */
export function authController<
	const ContentType extends t.TObject[] = [],
	const BasePath extends string = "",
>(app: Barista<ContentType, BasePath>): object {
	const { AUTH_EMAIL, AUTH_PASSWORD } = app.decorator
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

	if (!AUTH_EMAIL)
		throw new InvalidEnvironmentException(
			"@roastery::capsules:auth",
			"AUTH_EMAIL was missing in environment file.",
		);

	if (!AUTH_PASSWORD)
		throw new InvalidEnvironmentException(
			"@roastery::capsules:auth",
			"AUTH_PASSWORD was missing in environment file.",
		);

	return app
		.derive({ as: "scoped" }, () => ({
			authAccessKey: new AccessKey(cache),
			authLoginAttempt: new LoginAttempt(cache),
		}))
		.post(
			"/auth/login",
			async ({
				body,
				cookie: { ACCESS_TOKEN },
				set,
				authLoginAttempt,
				authAccessKey,
			}) => {
				const attempts = await authLoginAttempt.check(body.email);

				if (attempts <= 0) {
					set.status = 429;
					return "Too many attempts. Try again later.";
				}

				const entryIsValid = verifyCredentials(
					body,
					"@roastery::capsules:auth",
					{
						email: AUTH_EMAIL,
						password: AUTH_PASSWORD,
					},
				);

				if (entryIsValid) {
					await authLoginAttempt.success(body.email);
				} else {
					await authLoginAttempt.fail(body.email, attempts);

					throw new BadRequestException("@roastery::capsules:auth");
				}

				const accessKey = await authAccessKey.set(body.email, generateUUID());

				ACCESS_TOKEN!.value = await jwt.sign({
					ACCESS_KEY: accessKey,
					EMAIL: body.email,
				});
				ACCESS_TOKEN!.httpOnly = true;
				ACCESS_TOKEN!.secure = true;
				ACCESS_TOKEN!.maxAge = CACHE_EXPIRATION_TIME.SAFE;
				ACCESS_TOKEN!.path = "/";
			},
			{
				body: VerifyCredentialsDTO,
				detail: {
					summary: "Authenticate user",
					tags: ["Auth"],
					description:
						"Authenticates the user and generates a unique session access key stored in a secure cookie. Features rate limiting with progressive recovery and protection against account enumeration.",
				},
				response: baristaResponse(
					{
						200: t.Undefined(),
						429: t.String({
							examples: "Too many attempts. Try again later.",
						}),
					},
					{
						infra: ["DatabaseUnavailableException"],
						application: ["BadRequestException"],
					},
				),
			},
		);
}
