import { HttpException, HttpStatus } from '@nestjs/common';

export class DevicesWledException extends HttpException {
	constructor(message: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
		super(message, status);
	}
}

export class WledConnectionException extends DevicesWledException {
	constructor(host: string, reason?: string) {
		super(`Failed to connect to WLED device at ${host}${reason ? `: ${reason}` : ''}`, HttpStatus.SERVICE_UNAVAILABLE);
	}
}

export class WledCommandException extends DevicesWledException {
	constructor(deviceId: string, command: string, reason?: string) {
		super(
			`Failed to execute command "${command}" on WLED device ${deviceId}${reason ? `: ${reason}` : ''}`,
			HttpStatus.BAD_REQUEST,
		);
	}
}

export class WledDeviceNotFoundException extends DevicesWledException {
	constructor(identifier: string) {
		super(`WLED device not found: ${identifier}`, HttpStatus.NOT_FOUND);
	}
}
