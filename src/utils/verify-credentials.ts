import { BadRequestException } from "@roastery/terroir/exceptions/application";
import { Schema } from "@roastery/terroir/schema";
import { VerifyCredentialsDTO } from "@/dtos";

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
