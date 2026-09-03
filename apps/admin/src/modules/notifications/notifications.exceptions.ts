export class NotificationsException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'NotificationsException';
		this.exception = exception;
	}
}

export class NotificationsApiException extends NotificationsException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'NotificationsApiException';
		this.code = code;
	}
}

export class NotificationsValidationException extends NotificationsException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'NotificationsValidationException';
	}
}
