export class HomeyMappingPreviewUnavailableError extends Error {
	constructor() {
		super('Homey mapping preview is unavailable');
		this.name = 'HomeyMappingPreviewUnavailableError';
	}
}

export class HomeyMappingPreviewDeviceNotFoundError extends Error {
	constructor() {
		super('Homey mapping preview device was not found');
		this.name = 'HomeyMappingPreviewDeviceNotFoundError';
	}
}
