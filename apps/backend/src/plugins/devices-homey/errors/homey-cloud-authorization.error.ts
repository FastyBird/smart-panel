export class HomeyCloudConfigurationError extends Error {
	constructor(message = 'Homey Cloud client configuration is unavailable') {
		super(message);
		this.name = 'HomeyCloudConfigurationError';
	}
}

export class HomeyCloudAuthorizationStateError extends Error {
	constructor(message = 'Homey Cloud authorization state is invalid or expired') {
		super(message);
		this.name = 'HomeyCloudAuthorizationStateError';
	}
}

export class HomeyCloudAuthorizationCapacityError extends Error {
	constructor() {
		super('Homey Cloud authorization is temporarily unavailable');
		this.name = 'HomeyCloudAuthorizationCapacityError';
	}
}
