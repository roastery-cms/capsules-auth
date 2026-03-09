import type { BaristaCacheInstance } from "@roastery-adapters/cache";

const MAX_ATTEMPTS = 5;
const RECOVERY_TIME_PER_ATTEMPT = 60 * 60 * 1000;

export class LoginAttempt {
	constructor(private readonly cache: BaristaCacheInstance) {}

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

	async success(email: string): Promise<void> {
		const key = `login-attempts:${email}`;
		await this.cache.del(key);
	}
}
