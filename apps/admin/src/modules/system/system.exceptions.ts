export class SystemException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'SystemException';
		this.exception = exception;
	}
}

export class SystemApiException extends SystemException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'SystemApiException';
		this.code = code;
	}
}

export class SystemValidationException extends SystemException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'SystemValidationException';
	}
}
