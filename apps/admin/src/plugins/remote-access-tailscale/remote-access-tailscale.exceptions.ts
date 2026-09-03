export class RemoteAccessTailscaleException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'RemoteAccessTailscaleException';
		this.exception = exception;
	}
}

export class RemoteAccessTailscaleApiException extends RemoteAccessTailscaleException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessTailscaleApiException';
		this.code = code;
	}
}

export class RemoteAccessTailscaleValidationException extends RemoteAccessTailscaleException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessTailscaleValidationException';
	}
}
