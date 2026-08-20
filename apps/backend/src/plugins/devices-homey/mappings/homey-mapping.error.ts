export class HomeyMappingConfigurationError extends Error {
	constructor(
		readonly source: string,
		readonly issues: readonly string[],
	) {
		super(`Homey built-in mapping configuration is invalid: ${source}`);
		this.name = 'HomeyMappingConfigurationError';
	}
}

export class HomeyMappingValueError extends Error {
	constructor(
		readonly mappingName: string,
		readonly direction: 'read' | 'write',
		readonly reason: string,
	) {
		super(`Homey mapping '${mappingName}' could not transform a ${direction} value: ${reason}`);
		this.name = 'HomeyMappingValueError';
	}
}
