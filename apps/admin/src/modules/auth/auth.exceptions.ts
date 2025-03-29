export class AuthException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'AuthException';
		this.exception = exception;
	}
}

export class AuthApiException extends AuthException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'AuthApiException';
	}
}

export class AuthValidationException extends AuthException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'AuthValidationException';
	}
}
