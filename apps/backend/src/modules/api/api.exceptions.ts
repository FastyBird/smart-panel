export class ApiException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ApiException';
	}
}

export class ApiNotFoundException extends ApiException {
	constructor(message: string) {
		super(message);
		this.name = 'ApiNotFoundException';
	}
}

export class ApiValidationException extends ApiException {
	constructor(message: string) {
		super(message);
		this.name = 'ApiValidationException';
	}
}

export class ApiNotAllowedException extends ApiException {
	constructor(message: string) {
		super(message);
		this.name = 'ApiNotAllowedException';
	}
}
