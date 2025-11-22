import { HttpException, HttpStatus } from '@nestjs/common';

export class DevicesShellyV1Exception extends HttpException {
	constructor(message: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
		super(message, status);
	}
}

export class DevicesShellyV1NotSupportedException extends DevicesShellyV1Exception {
	constructor(message: string) {
		super(message, HttpStatus.NOT_IMPLEMENTED);
	}
}

export class DevicesShellyV1ValidationException extends DevicesShellyV1Exception {
	constructor(message: string) {
		super(message, HttpStatus.BAD_REQUEST);
	}
}

export class DevicesShellyV1NotAllowedException extends DevicesShellyV1Exception {
	constructor(message: string) {
		super(message, HttpStatus.FORBIDDEN);
	}
}

export class DevicesShellyV1NotImplementedException extends DevicesShellyV1Exception {
	constructor(message: string) {
		super(message, HttpStatus.NOT_IMPLEMENTED);
	}
}
