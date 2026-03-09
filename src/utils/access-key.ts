import { CACHE_EXPIRATION_TIME } from "@roastery/seedbed/constants";
import { DatabaseUnavailableException } from "@roastery/terroir/exceptions/infra";
import type { BaristaCacheInstance } from "@roastery-adapters/cache";

export class AccessKey {
	constructor(private readonly cache: BaristaCacheInstance) {}

	async get(email: string): Promise<string | null> {
		return await this.cache.get(`access-key:${email}`);
	}

	async set(email: string, value: string): Promise<string> {
		try {
			await this.cache.setex(
				`access-key:${email}`,
				CACHE_EXPIRATION_TIME.SAFE,
				value,
			);

			return value;
		} catch (_) {
			throw new DatabaseUnavailableException(
				"auth@login",
				"Redis is Unavailable",
			);
		}
	}
}
