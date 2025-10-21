export class LoggerRotatingFileException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'LoggerRotatingFileException';
		this.exception = exception;
	}
}

export class LoggerRotatingFileApiException extends LoggerRotatingFileException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'LoggerRotatingFileApiException';
		this.code = code;
	}
}

export class LoggerRotatingFileValidationException extends LoggerRotatingFileException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'LoggerRotatingFileValidationException';
	}
}
