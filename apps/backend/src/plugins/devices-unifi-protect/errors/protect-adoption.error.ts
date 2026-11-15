import { ProtectErrorCategory } from './protect-api.error';

/** The console is not connected, has no usable identity, or failed a read; carries only the sanitized category. */
export class ProtectConsoleUnavailableError extends Error {
	constructor(readonly category: ProtectErrorCategory | null) {
		super('The UniFi Protect console is not available');
		this.name = 'ProtectConsoleUnavailableError';
	}
}

export class ProtectDeviceNotFoundError extends Error {
	constructor() {
		super('The UniFi Protect device was not found');
		this.name = 'ProtectDeviceNotFoundError';
	}
}

export class ProtectUnsupportedDeviceError extends Error {
	constructor() {
		super('The UniFi Protect device is not supported');
		this.name = 'ProtectUnsupportedDeviceError';
	}
}
