import { HttpException, HttpStatus } from '@nestjs/common';

export class DevicesModbusException extends HttpException {
	constructor(message: string | Record<string, unknown>, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
		super(message, status);
	}
}

export class ModbusConnectionException extends DevicesModbusException {
	constructor(host: string, reason?: string) {
		super(
			`Failed to connect to Modbus device at ${host}${reason ? `: ${reason}` : ''}`,
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

export class ModbusRequestException extends DevicesModbusException {
	constructor(deviceId: string, reason?: string) {
		super(`Modbus request failed for device ${deviceId}${reason ? `: ${reason}` : ''}`, HttpStatus.BAD_GATEWAY);
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
