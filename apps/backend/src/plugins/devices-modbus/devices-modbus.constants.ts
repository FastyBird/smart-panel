// Plugin identification
export const DEVICES_MODBUS_PLUGIN_NAME = 'devices-modbus-plugin';
export const DEVICES_MODBUS_PLUGIN_PREFIX = 'devices-modbus';
export const DEVICES_MODBUS_TYPE = 'devices-modbus';

// API Tag configuration
export const DEVICES_MODBUS_API_TAG_NAME = 'Devices module - Modbus plugin';
export const DEVICES_MODBUS_API_TAG_DESCRIPTION = 'Modbus TCP and RTU over TCP plugin for device management.';

export enum ModbusFraming {
	TCP = 'tcp',
	RTU_OVER_TCP = 'rtu_over_tcp',
}

export enum ModbusRegisterType {
	COIL = 'coil',
	DISCRETE_INPUT = 'discrete_input',
	INPUT_REGISTER = 'input_register',
	HOLDING_REGISTER = 'holding_register',
}

export enum ModbusDataType {
	BOOL = 'bool',
	INT16 = 'int16',
	UINT16 = 'uint16',
	INT32 = 'int32',
	UINT32 = 'uint32',
	FLOAT32 = 'float32',
}

/** Used for both byte order and word order. */
export enum ModbusByteOrder {
	BIG = 'big',
	LITTLE = 'little',
}

export enum ModbusBindingRole {
	READ = 'read',
	WRITE = 'write',
}

export enum ModbusWriteFunction {
	SINGLE = 'single',
	MULTIPLE = 'multiple',
}

export const MODBUS_DEFAULTS = {
	PORT: 502,
	FRAMING: ModbusFraming.TCP,
	CONNECT_TIMEOUT_MS: 2000,
	REQUEST_TIMEOUT_MS: 1000,
	INTER_REQUEST_DELAY_MS_TCP: 0,
	INTER_REQUEST_DELAY_MS_RTU_OVER_TCP: 20,
	MAX_IN_FLIGHT: 1,
	UNIT_ID: 1,
	POLL_INTERVAL_MS: 1000,
	MIN_POLL_INTERVAL_MS: 100,
	BYTE_ORDER: ModbusByteOrder.BIG,
	WORD_ORDER: ModbusByteOrder.BIG,
	MAX_READ_REGISTERS: 125,
	MAX_READ_BITS: 2000,
	MAX_READ_GAP: 0,
} as const;

/** Upper bounds of user-supplied settings. Timer delays stay far below 2^31-1 ms, above which Node fires after 1 ms. */
export const MODBUS_LIMITS = {
	/** Connect timeout, request timeout and inter-request delay. */
	MAX_TIMING_MS: 60_000,
	/** One day. */
	MAX_POLL_INTERVAL_MS: 86_400_000,
	MAX_IN_FLIGHT: 16,
	TEMPLATE_REVISION_MAX_LENGTH: 128,
} as const;
