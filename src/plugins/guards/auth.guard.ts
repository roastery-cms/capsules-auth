import { UnauthorizedException } from "@roastery/terroir/exceptions/application";
import { ResourceNotFoundException } from "@roastery/terroir/exceptions/infra";
import { cache } from "@roastery-adapters/cache";
import {
	BadRequestExceptionDTO,
	ResourceNotFoundExceptionDTO,
	UnauthorizedExceptionDTO,
} from "@/dtos/errors";
import { JWT } from "@/models";
import { AccessKey } from "@/utils/access-key";
import type { IAuthOptions } from "./types/auth-options.interface";
import { barista } from "@roastery/barista";

export const baristaAuth = ({
	layerName,
	jwtSecret,
	cacheProvider,
	redisUrl,
}: IAuthOptions) => {
	return barista()
		.use(
			cache({
				REDIS_URL: redisUrl,
				CACHE_PROVIDER: cacheProvider,
			}),
		)
		.use((app) => {
			const { cache } = app.decorator;
			return app.decorate("authAccessKey", new AccessKey(cache));
		})
		.derive({ as: "scoped" }, () => ({
			authJwt: new JWT(layerName, jwtSecret),
		}))
		.guard({
			as: "scoped",
			response: {
				400: BadRequestExceptionDTO,
				401: UnauthorizedExceptionDTO,
				404: ResourceNotFoundExceptionDTO,
			},
		})
		.onBeforeHandle(
			{ as: "scoped" },
			async ({ cookie: { ACCESS_TOKEN }, authJwt, authAccessKey }) => {
				if (!ACCESS_TOKEN || typeof ACCESS_TOKEN.value !== "string")
					throw new UnauthorizedException(layerName);

				const value = String(ACCESS_TOKEN.value);

				const {
					payload: { ACCESS_KEY, EMAIL },
				} = await authJwt.verify<{
					ACCESS_KEY: string | null;
					EMAIL: string | null;
				}>(value);

				if (!EMAIL)
					throw new ResourceNotFoundException(layerName, `EMAIL was missing`);

				const currentAccessKey = await authAccessKey.get(EMAIL);

				if (!ACCESS_KEY || ACCESS_KEY !== currentAccessKey)
					throw new UnauthorizedException(layerName);
			},
		);
};
