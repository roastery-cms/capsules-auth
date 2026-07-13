import { BadRequestException } from "@roastery/terroir/exceptions/application";
import { describe, expect, it } from "bun:test";
import { verifyCredentials } from "./verify-credentials";

const AUTH = { email: "john.doe@example.com", password: "Secret123!" };

describe("verifyCredentials", () => {
	it("throws BadRequestException when the e-mail is not a valid format", () => {
		expect(() =>
			verifyCredentials(
				{ email: "not-an-email", password: "Secret123!" },
				"@roastery::capsules:auth",
				AUTH,
			),
		).toThrow(BadRequestException);
	});

	it("throws BadRequestException when the password fails the complexity rule", () => {
		expect(() =>
			verifyCredentials(
				{ email: "john.doe@example.com", password: "weak" },
				"@roastery::capsules:auth",
				AUTH,
			),
		).toThrow(BadRequestException);
	});

	it("returns true when e-mail and password both match", () => {
		expect(
			verifyCredentials(
				{ email: "john.doe@example.com", password: "Secret123!" },
				"@roastery::capsules:auth",
				AUTH,
			),
		).toBe(true);
	});

	it("returns false when the e-mail does not match", () => {
		expect(
			verifyCredentials(
				{ email: "jane.doe@example.com", password: "Secret123!" },
				"@roastery::capsules:auth",
				AUTH,
			),
		).toBe(false);
	});

	it("returns false when the password does not match", () => {
		expect(
			verifyCredentials(
				{ email: "john.doe@example.com", password: "Wrong123!" },
				"@roastery::capsules:auth",
				AUTH,
			),
		).toBe(false);
	});
});
