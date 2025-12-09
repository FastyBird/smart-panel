export class DisplaysException extends Error {
	exception: string | null;

	constructor(message: string, exception: string | null = null) {
		super(message);
		this.name = 'DisplaysException';
		this.exception = exception;
	}
}

export class DisplaysValidationException extends DisplaysException {
	constructor(message: string, exception: string | null = null) {
		super(message, exception);
		this.name = 'DisplaysValidationException';
	}
}

export class DisplaysApiException extends DisplaysException {
	code: number | null;

	constructor(message: string, code: number | null = null) {
		super(message);
		this.name = 'DisplaysApiException';
		this.code = code;
	}
}
