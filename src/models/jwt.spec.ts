import { beforeEach, describe, expect, it, vi } from "bun:test";
import {
	InvalidJWTException,
	UnableToSignPayloadException,
} from "@roastery/terroir/exceptions/application";
import { SignJWT } from "jose";
import { JWT } from "./jwt";

describe("JWT Model", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("should sign a payload successfully", async () => {
		const jwt = new JWT("test-layer", "test-secret");
		const token = await jwt.sign({ foo: "bar" });
		expect(typeof token).toBe("string");
		expect(token.split(".").length).toBe(3);
	});

	it("should verify a valid token successfully", async () => {
		const jwt = new JWT("test-layer", "test-secret");
		const token = await jwt.sign({ foo: "bar" });

		const result = await jwt.verify<{ foo: string }>(token);
		expect(result.payload.foo).toBe("bar");
	});

	it("should throw UnableToSignPayloadException when signing fails", async () => {
		// Mock SignJWT to throw an error
		vi.spyOn(SignJWT.prototype, "sign").mockRejectedValue(
			new Error("Sign error"),
		);

		const jwt = new JWT("test-layer", "test-secret");
		await expect(jwt.sign({ foo: "bar" })).rejects.toThrow(
			UnableToSignPayloadException,
		);
	});

	it("should throw InvalidJWTException when verification fails", async () => {
		const jwt = new JWT("test-layer", "test-secret");
		await expect(jwt.verify("invalid.token.here")).rejects.toThrow(
			InvalidJWTException,
		);
	});
});
