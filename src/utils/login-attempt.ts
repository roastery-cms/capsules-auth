import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";

/** Maximum login attempts available to a single e-mail before lockout. */
const MAX_ATTEMPTS = 5;
/** Time to lazily recover one attempt: 1 hour, in milliseconds. */
const RECOVERY_TIME_PER_ATTEMPT = 60 * 60 * 1000;

/**
 * Rate limiter for the login endpoint, with lazy attempt recovery.
 *
 * @remarks
 * State is stored per e-mail under `login-attempts:<email>` as
 * `{ attempts, lastUpdate }`, and nothing expires on its own — recovery is
 * recomputed on read: {@link check} grants back
 * `floor(elapsed / RECOVERY_TIME_PER_ATTEMPT)` attempts (one per hour) since
 * `lastUpdate`, capped at {@link MAX_ATTEMPTS}. A failed login persists the
 * decremented counter; a successful login deletes the key entirely.
 */
export class LoginAttempt {
	/**
	 * @param cache - Cache instance injected by the host, decorated by
	 *   `@roastery-adapters/cache`.
	 */
	constructor(private readonly cache: BaristaCacheInstance) {}

	/**
	 * Computes how many attempts an e-mail has left, applying lazy recovery.
	 *
	 * @param email - E-mail being rate limited.
	 * @returns The remaining attempts, from `0` (locked out) up to
	 *   {@link MAX_ATTEMPTS}. Absent state counts as a fresh
	 *   {@link MAX_ATTEMPTS}.
	 */
	async check(email: string): Promise<number> {
		const key = `login-attempts:${email}`;
		const data = await this.cache.get(key);

		if (!data) return MAX_ATTEMPTS;

		const { attempts, lastUpdate } = JSON.parse(data) as {
			attempts: number;
			lastUpdate: number;
		};

		const now = Date.now();
		const elapsed = now - lastUpdate;
		const recovered = Math.floor(elapsed / RECOVERY_TIME_PER_ATTEMPT);

		const currentAttempts = Math.min(MAX_ATTEMPTS, attempts + recovered);

		return currentAttempts;
	}

	/**
	 * Records a failed login, consuming one attempt.
	 *
	 * @remarks
	 * Persists `max(0, currentAttempts - 1)` alongside a fresh `lastUpdate`,
	 * which restarts the one-hour recovery clock.
	 *
	 * @param email - E-mail being rate limited.
	 * @param currentAttempts - Remaining attempts as returned by {@link check}.
	 * @returns The attempts left after this failure.
	 */
	async fail(email: string, currentAttempts: number): Promise<number> {
		const key = `login-attempts:${email}`;
		const nextAttempts = Math.max(0, currentAttempts - 1);

		await this.cache.set(
			key,
			JSON.stringify({
				attempts: nextAttempts,
				lastUpdate: Date.now(),
			}),
		);

		return nextAttempts;
	}

	/**
	 * Clears the rate-limit state after a successful login.
	 *
	 * @param email - E-mail whose attempt counter should be reset.
	 */
	async success(email: string): Promise<void> {
		const key = `login-attempts:${email}`;
		await this.cache.del(key);
	}
}
