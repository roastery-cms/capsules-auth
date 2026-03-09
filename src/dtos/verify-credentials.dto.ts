import { EmailDTO, PasswordDTO } from "@roastery/beans/collections/dtos";
import { t } from "@roastery/terroir";

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

export type VerifyCredentialsDTO = t.Static<typeof VerifyCredentialsDTO>;
