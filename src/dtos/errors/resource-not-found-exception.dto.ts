import type { t } from "@roastery/terroir";
import { BadResponseDTO } from "./bad-response.dto";

export const ResourceNotFoundExceptionDTO = structuredClone(BadResponseDTO);

ResourceNotFoundExceptionDTO.examples = [
	{
		layer: "application",
		name: "Resource Not Found",
		message: "Resource not found in the {{SOURCE}} application.",
		layerName: "post@post-type",
	},
];

export type ResourceNotFoundExceptionDTO = t.Static<
	typeof ResourceNotFoundExceptionDTO
>;
