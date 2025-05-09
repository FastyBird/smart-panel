export class DevicesHomeAssistantException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'DevicesHomeAssistantException';
		this.exception = exception;
	}
}

export class DevicesHomeAssistantApiException extends DevicesHomeAssistantException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesHomeAssistantApiException';
		this.code = code;
	}
}

export class DevicesHomeAssistantValidationException extends DevicesHomeAssistantException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesHomeAssistantValidationException';
	}
}
