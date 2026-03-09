import type { t } from "@roastery/terroir";
import { BadResponseDTO } from "./bad-response.dto";

export const DatabaseUnavailableExceptionDTO = structuredClone(BadResponseDTO);

DatabaseUnavailableExceptionDTO.examples = [
	{
		layer: "infra",
		name: "Database Unavailable Exceptione",
		message: "Redis is Unavailable",
		layerName: "auth@login",
	},
];

export type DatabaseUnavailableExceptionDTO = t.Static<
	typeof DatabaseUnavailableExceptionDTO
>;
