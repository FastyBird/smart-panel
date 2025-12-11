import { HttpException, HttpStatus } from '@nestjs/common';

export class DisplaysException extends HttpException {
	constructor(message: string) {
		super(message, HttpStatus.UNPROCESSABLE_ENTITY);
	}
}

export class DisplaysNotFoundException extends HttpException {
	constructor(message: string) {
		super(message, HttpStatus.NOT_FOUND);
	}
}

export class DisplaysValidationException extends HttpException {
	constructor(message: string) {
		super(message, HttpStatus.UNPROCESSABLE_ENTITY);
	}
}

export class DisplaysRegistrationException extends HttpException {
	constructor(message: string) {
		super(message, HttpStatus.BAD_REQUEST);
	}
}
