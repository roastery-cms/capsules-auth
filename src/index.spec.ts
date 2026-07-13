import { Blend } from "@roastery/blend";
import { describe, expect, it } from "bun:test";
import { AuthEnvDependenciesDTO } from "./dtos";
import { Auth } from "./index";
import { authController } from "./plugins/controllers";
import AuthTags from "./plugins/tags";

describe("Auth capsule manifest", () => {
	it("extends Blend", () => {
		expect(new Auth()).toBeInstanceOf(Blend);
	});

	it("declares the package identity", () => {
		const auth = new Auth();

		expect(auth.name).toBe("@roastery-capsules/auth");
		expect(auth.version).toBe("0.1.0");
		expect(auth.license).toBe("MIT");
		expect(auth.owner).toEqual({
			name: "Alan Reis Anjos",
			email: "alanreisanjo@gmail.com",
			repository: "https://github.com/roastery-cms/capsules-auth",
		});
	});

	it("declares the environment contract and plugin it mounts", () => {
		const auth = new Auth();

		expect(auth.environmentNeeds).toBe(AuthEnvDependenciesDTO);
		expect(auth.plugin).toBe(authController);
	});

	it("declares its capsule dependencies", () => {
		const auth = new Auth();

		expect(auth.dependencies).toEqual({
			"@roastery-adapters/cache": "0.1.0",
			"@roastery-capsules/jwt": "0.0.1",
		});
	});

	it("declares the OpenAPI tag metadata", () => {
		const auth = new Auth();

		expect(auth.tag).toBe(AuthTags);
	});
});
