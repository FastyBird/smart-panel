export class DevicesHomeKitException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeKitException';
	}
}

export class DevicesHomeKitNotFoundException extends DevicesHomeKitException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeKitNotFoundException';
	}
}

export class DevicesHomeKitValidationException extends DevicesHomeKitException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeKitValidationException';
	}
}

export class DevicesHomeKitNotAllowedException extends DevicesHomeKitException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesHomeKitNotAllowedException';
	}
}
