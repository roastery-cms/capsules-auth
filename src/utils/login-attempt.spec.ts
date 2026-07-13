import { describe, expect, it, mock } from "bun:test";
import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";
import { LoginAttempt } from "./login-attempt";

const MAX_ATTEMPTS = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

function makeCache() {
	const store = new Map<string, string>();

	const get = mock(async (key: string) => store.get(key) ?? null);
	const set = mock(async (key: string, value: string) => {
		store.set(key, value);
		return "OK" as const;
	});
	const del = mock(async (...keys: string[]) => {
		let count = 0;
		for (const key of keys) if (store.delete(key)) count++;
		return count;
	});

	const cache = { get, set, del } as unknown as BaristaCacheInstance;

	return { cache, get, set, del, store };
}

describe("LoginAttempt", () => {
	describe("check", () => {
		it("grants MAX_ATTEMPTS when no state exists for the e-mail", async () => {
			const { cache } = makeCache();
			const loginAttempt = new LoginAttempt(cache);

			expect(await loginAttempt.check("john.doe@example.com")).toBe(
				MAX_ATTEMPTS,
			);
		});

		it("returns the stored attempts when the state is fresh", async () => {
			const { cache, store } = makeCache();
			store.set(
				"login-attempts:john.doe@example.com",
				JSON.stringify({ attempts: 2, lastUpdate: Date.now() }),
			);
			const loginAttempt = new LoginAttempt(cache);

			expect(await loginAttempt.check("john.doe@example.com")).toBe(2);
		});

		it("lazily recovers one attempt per elapsed hour, capped at MAX_ATTEMPTS", async () => {
			const { cache, store } = makeCache();
			store.set(
				"login-attempts:john.doe@example.com",
				JSON.stringify({
					attempts: 2,
					lastUpdate: Date.now() - 2 * ONE_HOUR_MS,
				}),
			);
			const loginAttempt = new LoginAttempt(cache);

			expect(await loginAttempt.check("john.doe@example.com")).toBe(4);
		});

		it("never recovers past MAX_ATTEMPTS", async () => {
			const { cache, store } = makeCache();
			store.set(
				"login-attempts:john.doe@example.com",
				JSON.stringify({
					attempts: 3,
					lastUpdate: Date.now() - 10 * ONE_HOUR_MS,
				}),
			);
			const loginAttempt = new LoginAttempt(cache);

			expect(await loginAttempt.check("john.doe@example.com")).toBe(
				MAX_ATTEMPTS,
			);
		});
	});

	describe("fail", () => {
		it("decrements the remaining attempts and persists a fresh lastUpdate", async () => {
			const { cache, set } = makeCache();
			const loginAttempt = new LoginAttempt(cache);

			const remaining = await loginAttempt.fail("john.doe@example.com", 3);

			expect(remaining).toBe(2);
			expect(set).toHaveBeenCalledTimes(1);

			const [key, value] = set.mock.calls[0] as [string, string];
			expect(key).toBe("login-attempts:john.doe@example.com");

			const persisted = JSON.parse(value) as {
				attempts: number;
				lastUpdate: number;
			};
			expect(persisted.attempts).toBe(2);
			expect(Math.abs(persisted.lastUpdate - Date.now())).toBeLessThan(1000);
		});

		it("never goes below zero attempts", async () => {
			const { cache } = makeCache();
			const loginAttempt = new LoginAttempt(cache);

			expect(await loginAttempt.fail("john.doe@example.com", 0)).toBe(0);
		});
	});

	describe("success", () => {
		it("clears the rate-limit state for the e-mail", async () => {
			const { cache, del } = makeCache();
			const loginAttempt = new LoginAttempt(cache);

			await loginAttempt.success("john.doe@example.com");

			expect(del).toHaveBeenCalledWith("login-attempts:john.doe@example.com");
		});
	});
});
