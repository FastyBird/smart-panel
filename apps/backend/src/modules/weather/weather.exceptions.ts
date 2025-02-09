export class WeatherException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WeatherException';
	}
}

export class WeatherNotFoundException extends WeatherException {
	constructor(message: string) {
		super(message);
		this.name = 'WeatherNotFoundException';
	}
}

export class WeatherValidationException extends WeatherException {
	constructor(message: string) {
		super(message);
		this.name = 'WeatherValidationException';
	}
}
