export class ScenesException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'ScenesException';
		this.exception = exception;
	}
}

export class ScenesApiException extends ScenesException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'ScenesApiException';
		this.code = code;
	}
}

export class ScenesValidationException extends ScenesException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'ScenesValidationException';
	}
}
