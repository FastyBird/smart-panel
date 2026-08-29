export class HomeyCloudGrantConflictError extends Error {
	constructor() {
		super('Homey Cloud authorization transaction is invalid, expired, or no longer current');
		this.name = 'HomeyCloudGrantConflictError';
	}
}

export class HomeyCloudGrantAuthorityError extends Error {
	constructor() {
		super('Homey Cloud authorization authority is no longer valid');
		this.name = 'HomeyCloudGrantAuthorityError';
	}
}

export class HomeyCloudGrantStateError extends Error {
	constructor() {
		super('Homey Cloud authorization persistence is unavailable');
		this.name = 'HomeyCloudGrantStateError';
	}
}
