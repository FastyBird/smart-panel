export class DevicesShellyNgException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesShellyNgException';
	}
}

export class DevicesShellyNgNotFoundException extends DevicesShellyNgException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesShellyNgNotFoundException';
	}
}

export class DevicesShellyNgValidationException extends DevicesShellyNgException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesShellyNgValidationException';
	}
}

export class DevicesShellyNgNotAllowedException extends DevicesShellyNgException {
	constructor(message: string) {
		super(message);
		this.name = 'DevicesShellyNgNotAllowedException';
	}
}
