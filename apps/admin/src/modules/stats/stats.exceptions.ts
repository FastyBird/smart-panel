export class StatsException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'StatsException';
		this.exception = exception;
	}
}

export class StatsApiException extends StatsException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'StatsApiException';
		this.code = code;
	}
}

export class StatsValidationException extends StatsException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'StatsValidationException';
	}
}
