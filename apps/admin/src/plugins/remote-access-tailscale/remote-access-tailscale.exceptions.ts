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
	/**
	 * The application-specific reason code the backend attaches to some 409/422 responses (D13,
	 * RA-27, #996 - `error.details.code`, read via `getErrorCode()`), e.g. `'operator-not-granted'`,
	 * `'daemon-not-active'`, `'not-signed-in'`, `'privileged-worker-unavailable'`,
	 * `'platform-unsupported'`. `null` for a response that carries no such code (a plain
	 * string-thrown exception on the backend, or a status that never had one to begin with) -
	 * defaults to `null` so existing call sites that only ever passed the first three arguments
	 * keep compiling and behaving the same way.
	 */
	public errorCode: string | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null, errorCode: string | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessTailscaleApiException';
		this.code = code;
		this.errorCode = errorCode;
	}
}

export class RemoteAccessTailscaleValidationException extends RemoteAccessTailscaleException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessTailscaleValidationException';
	}
}
