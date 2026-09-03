export class RemoteAccessException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RemoteAccessException';
	}
}

export class RemoteAccessProviderAlreadyRegisteredException extends RemoteAccessException {
	constructor(message: string) {
		super(message);
		this.name = 'RemoteAccessProviderAlreadyRegisteredException';
	}
}

export class RemoteAccessProviderNotFoundException extends RemoteAccessException {
	constructor(message: string) {
		super(message);
		this.name = 'RemoteAccessProviderNotFoundException';
	}
}

export class NoUrlAvailableException extends RemoteAccessException {
	constructor(message: string) {
		super(message);
		this.name = 'NoUrlAvailableException';
	}
}
