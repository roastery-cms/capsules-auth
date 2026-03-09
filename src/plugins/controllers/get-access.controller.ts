import { generateUUID } from "@roastery/beans/entity/helpers";
import { t } from "@roastery/terroir";
import { BadRequestException } from "@roastery/terroir/exceptions/application";
import { MissingPluginDependencyException } from "@roastery/terroir/exceptions/infra";
import { Schema } from "@roastery/terroir/schema";
import { cache } from "@roastery-adapters/cache";
import { AuthEnvDependenciesDTO, VerifyCredentialsDTO } from "@/dtos";
import {
	BadRequestExceptionDTO,
	DatabaseUnavailableExceptionDTO,
} from "@/dtos/errors";
import { JWT } from "@/models";
import { AccessKey, LoginAttempt, verifyCredentials } from "@/utils";
import { barista } from "@roastery/barista";

export function GetAccessController(data: AuthEnvDependenciesDTO) {
	if (!Schema.make(AuthEnvDependenciesDTO).match(data))
		throw new MissingPluginDependencyException("auth@login");

	const { AUTH_EMAIL, AUTH_PASSWORD, JWT_SECRET, CACHE_PROVIDER, REDIS_URL } =
		data;

	return barista()
		.decorate("jwt", new JWT("auth@login", JWT_SECRET))
		.use(cache({ REDIS_URL, CACHE_PROVIDER }))
		.use((app) => {
			const { cache } = app.decorator;
			return app
				.decorate("authAccessKey", new AccessKey(cache))
				.decorate("authLoginAttempt", new LoginAttempt(cache));
		})
		.post(
			"/auth/login",
			async ({
				body,
				jwt,
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

				const entryIsValid = verifyCredentials(body, "auth@login", {
					email: AUTH_EMAIL,
					password: AUTH_PASSWORD,
				});

				if (entryIsValid) {
					await authLoginAttempt.success(body.email);
				} else {
					await authLoginAttempt.fail(body.email, attempts);

					throw new BadRequestException("auth@login");
				}

				const accessKey = await authAccessKey.set(body.email, generateUUID());

				ACCESS_TOKEN!.value = await jwt.sign({
					ACCESS_KEY: accessKey,
					EMAIL: body.email,
				});
				ACCESS_TOKEN!.httpOnly = true;
				ACCESS_TOKEN!.secure = true;
				ACCESS_TOKEN!.maxAge = 60 * 60;
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
				response: {
					200: t.Undefined(),
					400: BadRequestExceptionDTO,
					429: t.String({
						examples: "Too many attempts. Try again later.",
					}),
					503: DatabaseUnavailableExceptionDTO,
				},
			},
		);
}
