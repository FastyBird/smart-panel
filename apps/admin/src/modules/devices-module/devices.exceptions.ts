export class DevicesException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'DevicesException';
		this.exception = exception;
	}
}

export class DevicesApiException extends DevicesException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesApiException';
		this.code = code;
	}
}

export class DevicesValidationException extends DevicesException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesValidationException';
	}
}
