export class ConfigException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'ConfigException';
		this.exception = exception;
	}
}

export class ConfigApiException extends ConfigException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'ConfigApiException';
		this.code = code;
	}
}

export class ConfigValidationException extends ConfigException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'ConfigValidationException';
	}
}
