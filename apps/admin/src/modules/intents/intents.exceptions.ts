export class IntentsException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'IntentsException';
		this.exception = exception;
	}
}

export class IntentsValidationException extends IntentsException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'IntentsValidationException';
	}
}
