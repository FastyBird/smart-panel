export class UsersException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UsersException';
	}
}

export class UsersNotFoundException extends UsersException {
	constructor(message: string) {
		super(message);
		this.name = 'UsersNotFoundException';
	}
}

export class UsersValidationException extends UsersException {
	constructor(message: string) {
		super(message);
		this.name = 'UsersValidationException';
	}
}
