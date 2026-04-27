import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception thrown when coordinator connection fails
 */
export class ZigbeeHerdsmanConnectionException extends HttpException {
	constructor(serialPort: string, reason: string) {
		super(
			{
				statusCode: HttpStatus.SERVICE_UNAVAILABLE,
				message: `Failed to connect to Zigbee coordinator at ${serialPort}: ${reason}`,
				error: 'Zigbee Herdsman Connection Error',
			},
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

/**
 * Exception thrown when a command fails
 */
export class ZigbeeHerdsmanCommandException extends HttpException {
	constructor(deviceAddress: string, command: string, reason: string) {
		super(
			{
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				message: `Failed to execute ${command} on device ${deviceAddress}: ${reason}`,
				error: 'Zigbee Herdsman Command Error',
			},
			HttpStatus.INTERNAL_SERVER_ERROR,
		);
	}
}

/**
 * Exception thrown when device is not found
 */
export class ZigbeeHerdsmanDeviceNotFoundException extends HttpException {
	constructor(identifier: string) {
		super(
			{
				statusCode: HttpStatus.NOT_FOUND,
				message: `Zigbee device not found: ${identifier}`,
				error: 'Device Not Found',
			},
			HttpStatus.NOT_FOUND,
		);
	}
}

/**
 * Exception thrown when coordinator is offline
 */
export class ZigbeeHerdsmanCoordinatorOfflineException extends HttpException {
	constructor() {
		super(
			{
				statusCode: HttpStatus.SERVICE_UNAVAILABLE,
				message: 'Zigbee coordinator is offline',
				error: 'Coordinator Offline',
			},
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

/**
 * Base exception for Zigbee Herdsman plugin errors
 */
export class DevicesZigbeeHerdsmanException extends HttpException {
	constructor(message: string) {
		super(
			{
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				message,
				error: 'Zigbee Herdsman Plugin Error',
			},
			HttpStatus.INTERNAL_SERVER_ERROR,
		);
	}
}

/**
 * Exception thrown when a device is not found
 */
export class DevicesZigbeeHerdsmanNotFoundException extends HttpException {
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

/**
 * Exception thrown when validation fails
 */
export class DevicesZigbeeHerdsmanValidationException extends HttpException {
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
