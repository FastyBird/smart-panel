export class DevicesShellyNgException extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'DevicesShellyNgException';
		this.exception = exception;
	}
}

export class DevicesShellyNgApiException extends DevicesShellyNgException {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesShellyNgApiException';
		this.code = code;
	}
}

export class DevicesShellyNgValidationException extends DevicesShellyNgException {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesShellyNgValidationException';
	}
}
