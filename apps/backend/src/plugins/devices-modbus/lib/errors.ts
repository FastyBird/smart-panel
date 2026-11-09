const EXCEPTION_NAMES: Record<number, string> = {
	0x01: 'illegal function',
	0x02: 'illegal data address',
	0x03: 'illegal data value',
	0x04: 'server device failure',
	0x05: 'acknowledge',
	0x06: 'server device busy',
	0x08: 'memory parity error',
	0x0a: 'gateway path unavailable',
	0x0b: 'gateway target device failed to respond',
};

/** The device answered with a Modbus exception response. */
export class ModbusExceptionError extends Error {
	constructor(readonly code: number) {
		super(`Modbus exception ${code} (${EXCEPTION_NAMES[code] ?? 'unknown exception'})`);

		this.name = 'ModbusExceptionError';
	}

	/** 0x0A / 0x0B: the gateway could not reach the unit, so the unit is unreachable rather than the request invalid. */
	get isGatewayError(): boolean {
		return this.code === 0x0a || this.code === 0x0b;
	}

	/**
	 * 0x01-0x03: the request itself is wrong for this unit (function, address range or value), so retrying the same
	 * request cannot succeed. Every other code describes a transient condition of the unit or the path to it.
	 */
	get isRequestError(): boolean {
		return this.code === 0x01 || this.code === 0x02 || this.code === 0x03;
	}
}

/** No response arrived within the request timeout. */
export class ModbusTimeoutError extends Error {
	constructor(message = 'Modbus request timed out', options?: ErrorOptions) {
		super(message, options);

		this.name = 'ModbusTimeoutError';
	}
}

/** The connection could not be established, was lost, or the response stream could not be parsed. */
export class ModbusConnectionError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);

		this.name = 'ModbusConnectionError';
	}
}

/** The endpoint is not connected (e.g. waiting to reconnect), so the request was not sent. */
export class ModbusEndpointUnavailableError extends Error {
	constructor(message = 'Modbus endpoint is unavailable', options?: ErrorOptions) {
		super(message, options);

		this.name = 'ModbusEndpointUnavailableError';
	}
}
