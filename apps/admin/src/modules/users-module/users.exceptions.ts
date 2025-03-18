export class UsersException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'UsersException';
		this.exception = exception;
	}
}

export class UsersApiException extends UsersException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'UsersApiException';
		this.code = code;
	}
}

export class UsersValidationException extends UsersException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'UsersValidationException';
	}
}
