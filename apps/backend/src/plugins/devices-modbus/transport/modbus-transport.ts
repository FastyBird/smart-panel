import { ModbusFraming, ModbusRegisterType, ModbusWriteFunction } from '../devices-modbus.constants';

export interface ModbusReadRequest {
	unitId: number;
	registerType: ModbusRegisterType;
	address: number;
	count: number;
}

export interface ModbusWriteRequest {
	unitId: number;
	registerType: ModbusRegisterType.COIL | ModbusRegisterType.HOLDING_REGISTER;
	address: number;
	values: boolean[] | number[];
	writeFunction: ModbusWriteFunction;
}

/**
 * One socket to one Modbus endpoint. It does not queue or retry: callers serialise requests
 * (one at a time on `rtu_over_tcp`) and own reconnects.
 */
export interface ModbusTransport {
	/** Rejects with `ModbusConnectionError` on refusal or after `connectTimeoutMs`. Resolves at once when already open. */
	connect(): Promise<void>;
	/** Idempotent and safe when never connected or still connecting; outstanding requests reject with `ModbusConnectionError`. */
	close(): Promise<void>;
	isOpen(): boolean;
	/** Resolves with exactly `count` values: booleans for coils and discrete inputs, numbers for registers. */
	read(request: ModbusReadRequest): Promise<boolean[] | number[]>;
	write(request: ModbusWriteRequest): Promise<void>;
	/** Fires once per established connection on every close, explicit `close()` included, with the socket error if any. */
	onClose(listener: (error?: Error) => void): void;
}

export interface ModbusTransportOptions {
	host: string;
	port: number;
	framing: ModbusFraming;
	connectTimeoutMs: number;
	requestTimeoutMs: number;
}
