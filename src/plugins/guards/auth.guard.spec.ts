import { JsonWebToken } from "@roastery-capsules/jwt";
import type { BaristaCacheInstance } from "@roastery-adapters/cache/types";
import type { Barista } from "@roastery/barista";
import {
	InvalidJWTException,
	UnauthorizedException,
} from "@roastery/terroir/exceptions/application";
import {
	MissingPluginDependencyException,
	ResourceNotFoundException,
} from "@roastery/terroir/exceptions/infra";
import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { auth } from "./auth.guard";

const jwt = new JsonWebToken("test", "test-secret");

function makeCache() {
	const store = new Map<string, string>();
	const get = mock(async (key: string) => store.get(key) ?? null);
	const cache = { get } as unknown as BaristaCacheInstance;

	return { cache, get, store };
}

function makeApp(env: Record<string, unknown>, cache: BaristaCacheInstance) {
	return new Elysia()
		.decorate("env", env)
		.decorate("cache", cache)
		.decorate("jwt", jwt) as unknown as Barista;
}

function makeGuardedApp(
	env: Record<string, unknown>,
	cache: BaristaCacheInstance,
) {
	let capturedError: unknown;

	const guarded = auth(makeApp(env, cache)) as unknown as Elysia;
	const withRoute = guarded
		.onError(({ error }) => {
			capturedError = error;
			return new Response(null, { status: 599 });
		})
		.get("/protected", () => "secret");

	return {
		handle: (request: Request) => withRoute.handle(request),
		getCapturedError: () => capturedError,
	};
}

describe("auth guard", () => {
	it("throws MissingPluginDependencyException when jwt is missing", () => {
		const { cache } = makeCache();
		const app = new Elysia()
			.decorate("env", {})
			.decorate("cache", cache) as unknown as Barista;

		expect(() => auth(app)).toThrow(MissingPluginDependencyException);
	});

	it("throws MissingPluginDependencyException when cache is missing", () => {
		const app = new Elysia()
			.decorate("env", {})
			.decorate("jwt", jwt) as unknown as Barista;

		expect(() => auth(app)).toThrow(MissingPluginDependencyException);
	});

	it("returns the app unchanged when IGNORE_AUTH is truthy", async () => {
		const { cache } = makeCache();
		const app = makeApp({ IGNORE_AUTH: true }, cache);

		const guarded = auth(app) as unknown as Elysia;
		const withRoute = guarded.get("/whoami", () => "ok");

		const response = await withRoute.handle(
			new Request("http://localhost/whoami"),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	it("throws UnauthorizedException when the ACCESS_TOKEN cookie is missing", async () => {
		const { cache } = makeCache();
		const { handle, getCapturedError } = makeGuardedApp({}, cache);

		await handle(new Request("http://localhost/protected"));

		expect(getCapturedError()).toBeInstanceOf(UnauthorizedException);
	});

	it("propagates InvalidJWTException for a malformed token", async () => {
		const { cache } = makeCache();
		const { handle, getCapturedError } = makeGuardedApp({}, cache);

		await handle(
			new Request("http://localhost/protected", {
				headers: { cookie: "ACCESS_TOKEN=not-a-real-jwt" },
			}),
		);

		expect(getCapturedError()).toBeInstanceOf(InvalidJWTException);
	});

	it("throws ResourceNotFoundException when EMAIL is missing from the token payload", async () => {
		const { cache } = makeCache();
		const { handle, getCapturedError } = makeGuardedApp({}, cache);
		const token = await jwt.sign({ ACCESS_KEY: "any-key", EMAIL: null });

		await handle(
			new Request("http://localhost/protected", {
				headers: { cookie: `ACCESS_TOKEN=${token}` },
			}),
		);

		expect(getCapturedError()).toBeInstanceOf(ResourceNotFoundException);
	});

	it("throws UnauthorizedException when ACCESS_KEY does not match the cached session", async () => {
		const { cache, store } = makeCache();
		store.set("access-key:someone@example.com", "correct-key");
		const { handle, getCapturedError } = makeGuardedApp({}, cache);
		const token = await jwt.sign({
			ACCESS_KEY: "wrong-key",
			EMAIL: "someone@example.com",
		});

		await handle(
			new Request("http://localhost/protected", {
				headers: { cookie: `ACCESS_TOKEN=${token}` },
			}),
		);

		expect(getCapturedError()).toBeInstanceOf(UnauthorizedException);
	});

	it("lets the request through when the token's ACCESS_KEY matches the cached session", async () => {
		const { cache, store } = makeCache();
		store.set("access-key:someone@example.com", "correct-key");
		const { handle } = makeGuardedApp({}, cache);
		const token = await jwt.sign({
			ACCESS_KEY: "correct-key",
			EMAIL: "someone@example.com",
		});

		const response = await handle(
			new Request("http://localhost/protected", {
				headers: { cookie: `ACCESS_TOKEN=${token}` },
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("secret");
	});
});
