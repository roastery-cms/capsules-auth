import { JsonWebToken } from "@roastery-capsules/jwt";
import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";
import type { Barista } from "@roastery/barista";
import { BadRequestException } from "@roastery/terroir/exceptions/application";
import {
	InvalidEnvironmentException,
	MissingPluginDependencyException,
} from "@roastery/terroir/exceptions/infra";
import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { authController } from "./get-access.controller";

const jwt = new JsonWebToken("test", "test-secret");
const AUTH_EMAIL = "john.doe@example.com";
const AUTH_PASSWORD = "Secret123!";

function makeCache() {
	const store = new Map<string, string>();

	const get = mock(async (key: string) => store.get(key) ?? null);
	const set = mock(async (key: string, value: string) => {
		store.set(key, value);
		return "OK" as const;
	});
	const setex = mock(async (key: string, _seconds: number, value: string) => {
		store.set(key, value);
		return "OK" as const;
	});
	const del = mock(async (...keys: string[]) => {
		let count = 0;
		for (const key of keys) if (store.delete(key)) count++;
		return count;
	});

	const cache = { get, set, setex, del } as unknown as BaristaCacheInstance;

	return { cache, get, set, setex, del, store };
}

function makeApp(env: Record<string, unknown>, cache: BaristaCacheInstance) {
	return new Elysia()
		.decorate("env", env)
		.decorate("cache", cache)
		.decorate("jwt", jwt) as unknown as Barista;
}

function makeLoginApp(
	env: Record<string, unknown>,
	cache: BaristaCacheInstance,
) {
	let capturedError: unknown;

	// `onError` must be registered before the route it should protect —
	// Elysia only wires error handling into routes defined afterwards.
	const appWithErrorCapture = (
		makeApp(env, cache) as unknown as Elysia
	).onError(({ error }) => {
		capturedError = error;
		return new Response(null, { status: 599 });
	});
	const controller = authController(
		appWithErrorCapture as unknown as Barista,
	) as unknown as Elysia;

	return {
		handle: (body: unknown) =>
			controller.handle(
				new Request("http://localhost/auth/login", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body),
				}),
			),
		getCapturedError: () => capturedError,
	};
}

describe("authController", () => {
	it("throws MissingPluginDependencyException when jwt is missing", () => {
		const { cache } = makeCache();
		const app = new Elysia()
			.decorate("env", { AUTH_EMAIL, AUTH_PASSWORD })
			.decorate("cache", cache) as unknown as Barista;

		expect(() => authController(app)).toThrow(MissingPluginDependencyException);
	});

	it("throws MissingPluginDependencyException when cache is missing", () => {
		const app = new Elysia()
			.decorate("env", { AUTH_EMAIL, AUTH_PASSWORD })
			.decorate("jwt", jwt) as unknown as Barista;

		expect(() => authController(app)).toThrow(MissingPluginDependencyException);
	});

	it("throws InvalidEnvironmentException when AUTH_EMAIL is missing", () => {
		const { cache } = makeCache();
		const app = makeApp({ AUTH_PASSWORD }, cache);

		expect(() => authController(app)).toThrow(InvalidEnvironmentException);
	});

	it("throws InvalidEnvironmentException when AUTH_PASSWORD is missing", () => {
		const { cache } = makeCache();
		const app = makeApp({ AUTH_EMAIL }, cache);

		expect(() => authController(app)).toThrow(InvalidEnvironmentException);
	});

	it("returns 429 when no login attempts are left", async () => {
		const { cache, store } = makeCache();
		store.set(
			"login-attempts:john.doe@example.com",
			JSON.stringify({ attempts: 0, lastUpdate: Date.now() }),
		);
		const { handle } = makeLoginApp({ AUTH_EMAIL, AUTH_PASSWORD }, cache);

		const response = await handle({
			email: AUTH_EMAIL,
			password: AUTH_PASSWORD,
		});

		expect(response.status).toBe(429);
		expect(await response.text()).toBe("Too many attempts. Try again later.");
	});

	it("consumes an attempt and throws BadRequestException on invalid credentials", async () => {
		const { cache, store } = makeCache();
		const { handle, getCapturedError } = makeLoginApp(
			{ AUTH_EMAIL, AUTH_PASSWORD },
			cache,
		);

		await handle({ email: AUTH_EMAIL, password: "WrongPassword1!" });

		expect(getCapturedError()).toBeInstanceOf(BadRequestException);

		const persisted = JSON.parse(
			store.get("login-attempts:john.doe@example.com") as string,
		) as { attempts: number };
		expect(persisted.attempts).toBe(4);
	});

	it("authenticates valid credentials, resets attempts and sets the ACCESS_TOKEN cookie", async () => {
		const { cache, store } = makeCache();
		const { handle } = makeLoginApp({ AUTH_EMAIL, AUTH_PASSWORD }, cache);

		const response = await handle({
			email: AUTH_EMAIL,
			password: AUTH_PASSWORD,
		});

		expect(response.status).toBe(200);
		expect(store.has("login-attempts:john.doe@example.com")).toBe(false);

		const setCookie = response.headers
			.getSetCookie()
			.find((cookie) => cookie.startsWith("ACCESS_TOKEN="));
		expect(setCookie).toBeDefined();
		expect(setCookie?.toLowerCase()).toContain("httponly");
		expect(setCookie?.toLowerCase()).toContain("secure");
		expect(setCookie?.toLowerCase()).toContain("path=/");
		expect(setCookie?.toLowerCase()).toContain("max-age=3600");

		const token = setCookie?.split(";")[0]?.split("=")[1] as string;
		const { payload } = await jwt.verify<{
			ACCESS_KEY: string;
			EMAIL: string;
		}>(token);

		expect(payload.EMAIL).toBe(AUTH_EMAIL);
		expect(payload.ACCESS_KEY).toBe(
			store.get("access-key:john.doe@example.com")!,
		);
	});
});
