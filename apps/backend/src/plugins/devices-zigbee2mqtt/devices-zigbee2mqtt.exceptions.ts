import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception thrown when MQTT connection fails
 */
export class Zigbee2mqttConnectionException extends HttpException {
	constructor(host: string, reason: string) {
		super(
			{
				statusCode: HttpStatus.SERVICE_UNAVAILABLE,
				message: `Failed to connect to Zigbee2MQTT broker at ${host}: ${reason}`,
				error: 'Zigbee2MQTT Connection Error',
			},
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

/**
 * Exception thrown when a command fails
 */
export class Zigbee2mqttCommandException extends HttpException {
	constructor(deviceName: string, command: string, reason: string) {
		super(
			{
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				message: `Failed to execute ${command} on device ${deviceName}: ${reason}`,
				error: 'Zigbee2MQTT Command Error',
			},
			HttpStatus.INTERNAL_SERVER_ERROR,
		);
	}
}

/**
 * Exception thrown when device is not found
 */
export class Zigbee2mqttDeviceNotFoundException extends HttpException {
	constructor(identifier: string) {
		super(
			{
				statusCode: HttpStatus.NOT_FOUND,
				message: `Zigbee2MQTT device not found: ${identifier}`,
				error: 'Device Not Found',
			},
			HttpStatus.NOT_FOUND,
		);
	}
}

/**
 * Exception thrown when bridge is offline
 */
export class Zigbee2mqttBridgeOfflineException extends HttpException {
	constructor() {
		super(
			{
				statusCode: HttpStatus.SERVICE_UNAVAILABLE,
				message: 'Zigbee2MQTT bridge is offline',
				error: 'Bridge Offline',
			},
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}
