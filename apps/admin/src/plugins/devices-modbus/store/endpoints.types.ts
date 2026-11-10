import type { DevicesModbusPluginEndpointHealthState, DevicesModbusPluginFraming } from '../../../openapi.constants';

export interface IModbusEndpoint {
	id: string;
	name: string;
	host: string;
	port: number;
	framing: DevicesModbusPluginFraming;
	connectTimeoutMs: number;
	requestTimeoutMs: number;
	interRequestDelayMs: number;
	maxInFlight: number;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date | null;
}

export interface IModbusEndpointHealth {
	state: DevicesModbusPluginEndpointHealthState;
	lastError: string | null;
	lastErrorAt: Date | null;
	averageLatencyMs: number | null;
	requests: number;
	timeouts: number;
	overloaded: boolean;
}

export interface IModbusEndpointCreate {
	name: string;
	host: string;
	port?: number;
	framing?: DevicesModbusPluginFraming;
	connectTimeoutMs?: number;
	requestTimeoutMs?: number;
	interRequestDelayMs?: number;
	maxInFlight?: number;
	enabled?: boolean;
}

export type IModbusEndpointUpdate = Partial<IModbusEndpointCreate>;
