import { HttpException, HttpStatus } from '@nestjs/common';

export class ShellyV1Exception extends HttpException {
	constructor(message: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
		super(message, status);
	}
}

export class ShellyV1DeviceNotFoundException extends ShellyV1Exception {
	constructor(deviceId: string) {
		super(`Shelly V1 device with ID ${deviceId} not found`, HttpStatus.NOT_FOUND);
	}
}

export class ShellyV1CommunicationException extends ShellyV1Exception {
	constructor(message: string) {
		super(`Shelly V1 communication error: ${message}`, HttpStatus.SERVICE_UNAVAILABLE);
	}
}

export class ShellyV1ConfigurationException extends ShellyV1Exception {
	constructor(message: string) {
		super(`Shelly V1 configuration error: ${message}`, HttpStatus.BAD_REQUEST);
	}
}
