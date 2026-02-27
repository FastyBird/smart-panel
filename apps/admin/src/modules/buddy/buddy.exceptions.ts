export class BuddyException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'BuddyException';
		this.exception = exception;
	}
}

export class BuddyApiException extends BuddyException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'BuddyApiException';
		this.code = code;
	}
}

export class BuddyValidationException extends BuddyException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'BuddyValidationException';
	}
}
