import { StringDTO } from "@roastery/beans/collections/dtos";
import { t } from "@roastery/terroir";
import { ErrorTypeDTO } from "./error-type.dto";

export const BadResponseDTO = t.Object(
	{
		layer: ErrorTypeDTO,
		name: StringDTO,
		message: StringDTO,
		layerName: StringDTO,
	},
	{
		description: "Detailed error information if the request failed.",
		examples: [
			{
				layer: "domain",
				name: "EntityNotFoundError",
				message: "Post not found",
				layerName: "PostDomain",
			},
		],
	},
);

export type BadResponseDTO = t.Static<typeof BadResponseDTO>;
