export class HomeyInventoryUnavailableError extends Error {
	constructor() {
		super('Homey inventory is unavailable');
		this.name = 'HomeyInventoryUnavailableError';
	}
}

export class HomeyInventoryDeviceNotFoundError extends Error {
	constructor() {
		super('Homey device was not found');
		this.name = 'HomeyInventoryDeviceNotFoundError';
	}
}
