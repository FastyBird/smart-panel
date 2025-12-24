export class SpacesException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'SpacesException';
		this.exception = exception;
	}
}

export class SpacesValidationException extends SpacesException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'SpacesValidationException';
	}
}

export class SpacesApiException extends SpacesException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'SpacesApiException';
		this.code = code;
	}
}
