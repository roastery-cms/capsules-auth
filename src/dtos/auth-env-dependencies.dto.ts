import { EmailDTO, PasswordDTO } from "@roastery/beans/collections/dtos";
import { t } from "@roastery/terroir";

/**
 * TypeBox validation schema for the authentication environment variables.
 *
 * @remarks
 * The capsule authenticates a single credential pair: `AUTH_EMAIL` and
 * `AUTH_PASSWORD` are compared verbatim against the login request body.
 * Declared as `environmentNeeds` on the capsule manifest so the host
 * validates the environment before mounting the plugin.
 */
export const AuthEnvDependenciesDTO = t.Object(
	{
		/** E-mail half of the single credential pair accepted by `POST /auth/login`. */
		AUTH_EMAIL: EmailDTO,
		/** Password half of the single credential pair accepted by `POST /auth/login`. */
		AUTH_PASSWORD: PasswordDTO,
		/**
		 * When truthy, the `auth` guard returns the app unchanged, disabling
		 * route protection entirely — development only.
		 *
		 * @defaultValue false
		 */
		IGNORE_AUTH: t.Optional(t.Boolean(), false),
	},
	{
		description:
			"Validation schema for the authentication environment variables.",
		examples: [
			{
				AUTH_EMAIL: "admin@roastery-cms.com",
				AUTH_PASSWORD: "secure_password123",
			},
		],
	},
);

/**
 * Static type inferred from the {@link AuthEnvDependenciesDTO} schema —
 * declaration merging keeps the runtime schema and its type under one name.
 */
export type AuthEnvDependenciesDTO = t.Static<typeof AuthEnvDependenciesDTO>;
