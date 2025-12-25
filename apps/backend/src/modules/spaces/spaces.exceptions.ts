import { HttpException, HttpStatus } from '@nestjs/common';

export class SpacesException extends HttpException {
	constructor(message: string) {
		super(message, HttpStatus.UNPROCESSABLE_ENTITY);
	}
}

export class SpacesNotFoundException extends HttpException {
	constructor(message: string) {
		super(message, HttpStatus.NOT_FOUND);
	}
}

export class SpacesValidationException extends HttpException {
	constructor(message: string) {
		super(message, HttpStatus.UNPROCESSABLE_ENTITY);
	}
}
