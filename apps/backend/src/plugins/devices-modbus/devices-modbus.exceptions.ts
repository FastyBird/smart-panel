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

export class ModbusTemplateNotFoundException extends DevicesModbusException {
	constructor(id: string) {
		super(`Modbus template ${id} does not exist`, HttpStatus.NOT_FOUND);
	}
}

export class ModbusEndpointNotFoundException extends DevicesModbusException {
	constructor(id: string) {
		super(`Modbus endpoint ${id} does not exist`, HttpStatus.NOT_FOUND);
	}
}

export class ModbusProbeBusyException extends DevicesModbusException {
	constructor() {
		super('Another probe to this endpoint is still running.', HttpStatus.TOO_MANY_REQUESTS);
	}
}
