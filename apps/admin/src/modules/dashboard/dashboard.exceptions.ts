export class DashboardException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'DashboardException';
		this.exception = exception;
	}
}

export class DashboardApiException extends DashboardException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DashboardApiException';
		this.code = code;
	}
}

export class DashboardValidationException extends DashboardException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DashboardValidationException';
	}
}
