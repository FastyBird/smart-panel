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

/** Metadata from a rejected login only; profile and transport errors remain distinct. */
export class AuthLoginException extends AuthException {
	public readonly status: number | undefined;
	public readonly retryAfterSeconds: number | null;

	constructor(message: string, status?: number, retryAfter?: string | null) {
		super(message);
		this.name = 'AuthLoginException';
		this.status = status;
		const seconds = retryAfter && /^[0-9]{1,4}$/.test(retryAfter) ? Number(retryAfter) : 0;
		this.retryAfterSeconds = status === 429 && seconds > 0 && seconds <= 3600 ? seconds : null;
	}
}
