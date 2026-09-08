export class RemoteAccessCloudflareTunnelException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'RemoteAccessCloudflareTunnelException';
		this.exception = exception;
	}
}

export class RemoteAccessCloudflareTunnelApiException extends RemoteAccessCloudflareTunnelException {
	public code: number | null;
	/**
	 * The application-specific reason code the backend attaches to `POST /install`'s `422`
	 * response (`CloudflareTunnelSetupUnavailableException.code`, read via `getErrorCode()`):
	 * `'privileged-worker-unavailable'` or `'platform-unsupported'`. Mirrors
	 * `RemoteAccessTailscaleApiException.errorCode` - `null` for a response that carries no such
	 * code (the plain-string `409` a busy setup job throws, a generic `500`, or a status that never
	 * had one to begin with).
	 */
	public errorCode: string | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null, errorCode: string | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessCloudflareTunnelApiException';
		this.code = code;
		this.errorCode = errorCode;
	}
}

export class RemoteAccessCloudflareTunnelValidationException extends RemoteAccessCloudflareTunnelException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'RemoteAccessCloudflareTunnelValidationException';
	}
}
