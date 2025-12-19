export class ExtensionsException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);

		this.name = 'ExtensionsException';
		this.exception = exception;

		Object.setPrototypeOf(this, ExtensionsException.prototype);
	}
}

export class ExtensionsApiException extends ExtensionsException {
	public code: number | null;

	constructor(message: string, code: number | null = null) {
		super(message);

		this.name = 'ExtensionsApiException';
		this.code = code;

		Object.setPrototypeOf(this, ExtensionsApiException.prototype);
	}
}

export class ExtensionsValidationException extends ExtensionsException {
	constructor(message: string) {
		super(message);

		this.name = 'ExtensionsValidationException';

		Object.setPrototypeOf(this, ExtensionsValidationException.prototype);
	}
}
