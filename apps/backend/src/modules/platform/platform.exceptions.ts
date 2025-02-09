export class PlatformException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PlatformException';
	}
}

export class PlatformNotSupportedException extends PlatformException {
	constructor(message: string) {
		super(message);
		this.name = 'PlatformNotSupportedException';
	}
}

export class PlatformValidationException extends PlatformException {
	constructor(message: string) {
		super(message);
		this.name = 'PlatformValidationException';
	}
}
