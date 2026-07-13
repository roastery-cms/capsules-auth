import { CACHE_EXPIRATION_TIME } from "@roastery/pantry/constants";
import { DatabaseUnavailableException } from "@roastery/terroir/exceptions/infra";
import { describe, expect, it, mock } from "bun:test";
import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";
import { AccessKey } from "./access-key";

function makeCache() {
	const store = new Map<string, string>();

	const get = mock(async (key: string) => store.get(key) ?? null);
	const setex = mock(async (key: string, _seconds: number, value: string) => {
		store.set(key, value);
		return "OK" as const;
	});

	const cache = { get, setex } as unknown as BaristaCacheInstance;

	return { cache, get, setex };
}

describe("AccessKey", () => {
	describe("get", () => {
		it("returns null when no session exists for the e-mail", async () => {
			const { cache } = makeCache();
			const accessKey = new AccessKey(cache);

			expect(await accessKey.get("john.doe@example.com")).toBeNull();
		});

		it("returns the cached access key for the e-mail", async () => {
			const { cache } = makeCache();
			const accessKey = new AccessKey(cache);
			await accessKey.set("john.doe@example.com", "session-uuid");

			expect(await accessKey.get("john.doe@example.com")).toBe("session-uuid");
		});
	});

	describe("set", () => {
		it("persists the value under access-key:<email> with the SAFE TTL", async () => {
			const { cache, setex } = makeCache();
			const accessKey = new AccessKey(cache);

			await accessKey.set("john.doe@example.com", "session-uuid");

			expect(setex).toHaveBeenCalledWith(
				"access-key:john.doe@example.com",
				CACHE_EXPIRATION_TIME.SAFE,
				"session-uuid",
			);
		});

		it("returns the stored value", async () => {
			const { cache } = makeCache();
			const accessKey = new AccessKey(cache);

			expect(await accessKey.set("john.doe@example.com", "session-uuid")).toBe(
				"session-uuid",
			);
		});

		it("throws DatabaseUnavailableException when the cache is unavailable", async () => {
			const { cache, setex } = makeCache();
			setex.mockImplementation(() => Promise.reject(new Error("ECONNREFUSED")));
			const accessKey = new AccessKey(cache);

			await expect(
				accessKey.set("john.doe@example.com", "session-uuid"),
			).rejects.toThrow(DatabaseUnavailableException);
		});
	});
});
