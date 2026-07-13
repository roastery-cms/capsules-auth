import { EmailDTO, PasswordDTO } from "@roastery/beans/collections/dtos";
import { t } from "@roastery/terroir";

/**
 * TypeBox validation schema for the `POST /auth/login` request body.
 *
 * @remarks
 * The submitted pair is compared against the host's `AUTH_EMAIL` /
 * `AUTH_PASSWORD` environment credentials by `verifyCredentials`, which also
 * reuses this schema to revalidate the payload shape at the domain boundary.
 */
export const VerifyCredentialsDTO = t.Object(
	{
		email: EmailDTO,
		password: PasswordDTO,
	},
	{
		description: "Data required to verify user credentials.",
		examples: [
			{
				email: "john.doe@example.com",
				password: "Password123!",
			},
		],
	},
);

/**
 * Static type inferred from the {@link VerifyCredentialsDTO} schema —
 * declaration merging keeps the runtime schema and its type under one name.
 */
export type VerifyCredentialsDTO = t.Static<typeof VerifyCredentialsDTO>;
