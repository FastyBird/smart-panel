export class DevicesException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesException';
	}
}

export class DevicesNotFoundException extends DevicesException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesNotFoundException';
	}
}

export class DevicesValidationException extends DevicesException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesValidationException';
	}
}
