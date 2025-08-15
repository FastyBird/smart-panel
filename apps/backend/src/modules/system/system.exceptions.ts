export class SystemException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SystemException';
	}
}

export class SystemNotFoundException extends SystemException {
	constructor(message: string) {
		super(message);
		this.name = 'SystemNotFoundException';
	}
}

export class SystemValidationException extends SystemException {
	constructor(message: string) {
		super(message);
		this.name = 'SystemValidationException';
	}
}
