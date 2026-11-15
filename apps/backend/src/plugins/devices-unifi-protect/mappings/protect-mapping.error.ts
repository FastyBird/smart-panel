export class ProtectMappingConfigurationError extends Error {
	constructor(
		readonly file: string,
		readonly errors: readonly string[],
	) {
		super(`UniFi Protect mapping configuration is invalid: ${file}`);
		this.name = 'ProtectMappingConfigurationError';
	}
}
