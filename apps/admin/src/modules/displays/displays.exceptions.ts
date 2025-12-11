export class DisplaysException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'DisplaysException';
		this.exception = exception;
	}
}

export class DisplaysValidationException extends DisplaysException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DisplaysValidationException';
	}
}

export class DisplaysApiException extends DisplaysException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DisplaysApiException';
		this.code = code;
	}
}
