import type { t } from "@roastery/terroir";
import { BadResponseDTO } from "./bad-response.dto";

export const UnauthorizedExceptionDTO = structuredClone(BadResponseDTO);

UnauthorizedExceptionDTO.examples = [
	{
		layer: "application",
		name: "Unauthorized",
		message: "Unauthorized access to the {{SOURCE}} application.",
		layerName: "post@post-type",
	},
];

export type UnauthorizedExceptionDTO = t.Static<
	typeof UnauthorizedExceptionDTO
>;
