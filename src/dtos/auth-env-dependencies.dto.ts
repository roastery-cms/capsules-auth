import { EmailDTO, PasswordDTO } from "@roastery/beans/collections/dtos";
import { t } from "@roastery/terroir";
import { CacheEnvDependenciesDTO } from "@roastery-adapters/cache/dtos";

export const AuthEnvDependenciesDTO = t.Composite([
	t.Object(
		{
			JWT_SECRET: t.String({
				description:
					"Secret key used to sign and validate the authenticity of JWT tokens.",
				examples: ["super_secret_jwt_key_example"],
			}),
			AUTH_EMAIL: EmailDTO,
			AUTH_PASSWORD: PasswordDTO,
		},
		{
			description:
				"Validation schema for the authentication environment variables.",
			examples: [
				{
					JWT_SECRET: "super_secret_jwt_key_example",
					AUTH_EMAIL: "admin@roastery-cms.com",
					AUTH_PASSWORD: "secure_password123",
				},
			],
		},
	),
	CacheEnvDependenciesDTO,
]);

export type AuthEnvDependenciesDTO = t.Static<typeof AuthEnvDependenciesDTO>;
