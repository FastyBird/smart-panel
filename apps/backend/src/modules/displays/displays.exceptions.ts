import { HttpException, HttpStatus } from '@nestjs/common';

export class DisplaysException extends HttpException {
	constructor(message: string) {
		super(
			{
				statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
				message,
				error: 'Unprocessable Entity',
			},
			HttpStatus.UNPROCESSABLE_ENTITY,
		);
	}
}

export class DisplaysNotFoundException extends HttpException {
	constructor(message: string) {
		super(
			{
				statusCode: HttpStatus.NOT_FOUND,
				message,
				error: 'Not Found',
			},
			HttpStatus.NOT_FOUND,
		);
	}
}

export class DisplaysValidationException extends HttpException {
	constructor(message: string) {
		super(
			{
				statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
				message,
				error: 'Validation Error',
			},
			HttpStatus.UNPROCESSABLE_ENTITY,
		);
	}
}

export class DisplaysRegistrationException extends HttpException {
	constructor(message: string) {
		super(
			{
				statusCode: HttpStatus.BAD_REQUEST,
				message,
				error: 'Bad Request',
			},
			HttpStatus.BAD_REQUEST,
		);
	}
}
