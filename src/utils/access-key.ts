import { CACHE_EXPIRATION_TIME } from "@roastery/pantry/constants";
import { DatabaseUnavailableException } from "@roastery/terroir/exceptions/infra";
import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";

/**
 * Cache wrapper for the session access key of a given e-mail.
 *
 * @remarks
 * Keys are stored under `access-key:<email>` with a
 * {@link CACHE_EXPIRATION_TIME}.SAFE TTL (3600 seconds). Because there is a
 * single entry per e-mail, a new login overwrites — and therefore revokes —
 * the previous key, and deleting the entry revokes the session outright: the
 * guard rejects any token whose `ACCESS_KEY` no longer matches the cached one.
 *
 * @example
 * ```ts
 * const accessKey = new AccessKey(cache);
 *
 * await accessKey.set("admin@roastery-cms.com", generateUUID());
 * const current = await accessKey.get("admin@roastery-cms.com");
 * ```
 */
export class AccessKey {
	/**
	 * @param cache - Cache instance injected by the host, decorated by
	 *   `@roastery-adapters/cache`.
	 */
	constructor(private readonly cache: BaristaCacheInstance) {}

	/**
	 * Reads the access key currently cached for an e-mail.
	 *
	 * @param email - E-mail whose session key should be looked up.
	 * @returns The cached access key, or `null` when no session exists —
	 *   never created, expired, or revoked.
	 */
	async get(email: string): Promise<string | null> {
		return await this.cache.get(`access-key:${email}`);
	}

	/**
	 * Persists a new access key for an e-mail, replacing any previous one.
	 *
	 * @param email - E-mail the session key belongs to.
	 * @param value - Access key to store, a UUID minted at login.
	 * @returns The stored value, for chaining into the signed token payload.
	 * @throws {@link DatabaseUnavailableException} carrying the `"auth@login"`
	 *   layer when the cache is unavailable.
	 */
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
