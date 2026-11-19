export class CamerasException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'CamerasException';
		this.exception = exception;
	}
}

export class CamerasApiException extends CamerasException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'CamerasApiException';
		this.code = code;
	}
}

export class CamerasValidationException extends CamerasException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'CamerasValidationException';
	}
}
