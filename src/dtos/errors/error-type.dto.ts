import { t } from "@roastery/terroir";

export const ErrorTypeDTO = t.Union(
	[
		t.Literal("internal"),
		t.Literal("domain"),
		t.Literal("application"),
		t.Literal("infra"),
	],
	{
		description: "The architectural layer where the error originated.",
		examples: ["domain"],
	},
);

export type ErrorTypeDTO = t.Static<typeof ErrorTypeDTO>;
