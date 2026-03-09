export interface IAuthOptions {
	layerName: string;
	jwtSecret: string;
	redisUrl?: string;
	cacheProvider: "REDIS" | "MEMORY";
}
