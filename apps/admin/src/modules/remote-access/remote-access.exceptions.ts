export class RemoteAccessException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'RemoteAccessException';
		this.exception = exception;
	}
}

export class RemoteAccessApiException extends RemoteAccessException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessApiException';
		this.code = code;
	}
}

export class RemoteAccessValidationException extends RemoteAccessException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessValidationException';
	}
}
