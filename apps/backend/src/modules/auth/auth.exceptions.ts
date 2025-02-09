export class AuthException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthException';
	}
}

export class AuthUnauthorizedException extends AuthException {
	constructor(message: string) {
		super(message);
		this.name = 'AuthUnauthorizedException';
	}
}

export class AuthNotFoundException extends AuthException {
	constructor(message: string) {
		super(message);
		this.name = 'AuthNotFoundException';
	}
}

export class AuthValidationException extends AuthException {
	constructor(message: string) {
		super(message);
		this.name = 'AuthValidationException';
	}
}
