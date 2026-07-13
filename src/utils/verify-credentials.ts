import { BadRequestException } from "@roastery/terroir/exceptions/application";
import { Schema } from "@roastery/terroir/schema";
import { VerifyCredentialsDTO } from "@/dtos";

/**
 * Validates a login attempt against the configured credential pair.
 *
 * @remarks
 * The payload shape is revalidated with `Schema.make(...).match` before any
 * comparison, so malformed input never reaches the credential check. To
 * prevent account enumeration, an incorrect e-mail and an incorrect password
 * are indistinguishable: both return the same `false`.
 *
 * @param data - Credentials submitted by the client.
 * @param layerName - Identifier carried by the exception thrown on a
 *   malformed payload.
 * @param auth - Expected credential pair, sourced from the environment
 *   (`AUTH_EMAIL` / `AUTH_PASSWORD`).
 * @returns `true` when both e-mail and password match; `false` otherwise.
 * @throws {@link BadRequestException} with the given `layerName` when `data`
 *   does not match {@link VerifyCredentialsDTO}.
 */
export function verifyCredentials(
	data: VerifyCredentialsDTO,
	layerName: string,
	auth: VerifyCredentialsDTO,
): boolean {
	if (!Schema.make(VerifyCredentialsDTO).match(data))
		throw new BadRequestException(layerName);

	const { email, password } = data;

	return email === auth.email && password === auth.password;
}
