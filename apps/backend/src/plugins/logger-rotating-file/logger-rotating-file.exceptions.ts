export class LoggerRotatingFileException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LoggerRotatingFileException';
	}
}

export class LoggerRotatingFileNotFoundException extends LoggerRotatingFileException {
	constructor(message: string) {
		super(message);
		this.name = 'LoggerRotatingFileNotFoundException';
	}
}

export class LoggerRotatingFileValidationException extends LoggerRotatingFileException {
	constructor(message: string) {
		super(message);
		this.name = 'LoggerRotatingFileValidationException';
	}
}

export class LoggerRotatingFileNotAllowedException extends LoggerRotatingFileException {
	constructor(message: string) {
		super(message);
		this.name = 'LoggerRotatingFileNotAllowedException';
	}
}
