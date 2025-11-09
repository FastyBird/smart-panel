export class StatsException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StatsException';
	}
}

export class StatsNotFoundException extends StatsException {
	constructor(message: string) {
		super(message);
		this.name = 'StatsNotFoundException';
	}
}

export class StatsValidationException extends StatsException {
	constructor(message: string) {
		super(message);
		this.name = 'StatsValidationException';
	}
}

export class StatsNotAllowedException extends StatsException {
	constructor(message: string) {
		super(message);
		this.name = 'StatsNotAllowedException';
	}
}
