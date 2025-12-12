export class DevicesShellyV1Exception extends Error {
	public exception: Error | null;

	constructor(message: string, exception: Error | null = null) {
		super(message);
		this.name = 'DevicesShellyV1Exception';
		this.exception = exception;
	}
}

export class DevicesShellyV1ApiException extends DevicesShellyV1Exception {
	public code: number | null;

	constructor(message: string, code: number | null = null, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesShellyV1ApiException';
		this.code = code;
	}
}

export class DevicesShellyV1ValidationException extends DevicesShellyV1Exception {
	constructor(message: string, exception: Error | null = null) {
		super(message, exception);
		this.name = 'DevicesShellyV1ValidationException';
	}
}
