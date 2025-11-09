export class WeatherException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'WeatherException';
		this.exception = exception;
	}
}

export class WeatherApiException extends WeatherException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'WeatherApiException';
		this.code = code;
	}
}

export class WeatherValidationException extends WeatherException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'WeatherValidationException';
	}
}
