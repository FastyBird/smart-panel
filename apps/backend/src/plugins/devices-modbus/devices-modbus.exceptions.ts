import { HttpException, HttpStatus } from '@nestjs/common';

export class DevicesModbusException extends HttpException {
	constructor(message: string | Record<string, unknown>, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
		super(message, status);
	}
}

export class ModbusValidationException extends DevicesModbusException {
	/**
	 * `reasons` follows the DTO validation shape: an array of JSON-encoded `{ field, reason }` strings, which
	 * `BadRequestExceptionFilter` parses into `details[]`.
	 */
	constructor(reasons: string[]) {
		super({ statusCode: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: reasons }, HttpStatus.BAD_REQUEST);
	}
}
