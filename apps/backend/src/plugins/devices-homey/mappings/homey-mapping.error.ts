export class HomeyMappingConfigurationError extends Error {
	constructor(
		readonly source: string,
		readonly issues: readonly string[],
	) {
		super(`Homey built-in mapping configuration is invalid: ${source}`);
		this.name = 'HomeyMappingConfigurationError';
	}
}
