import { Inject, Injectable } from '@nestjs/common';

import { MODBUS_DEFAULTS, ModbusFraming, ModbusRegisterType } from '../devices-modbus.constants';
import {
	ModbusEndpointNotFoundException,
	ModbusProbeBusyException,
	ModbusValidationException,
} from '../devices-modbus.exceptions';
import { ModbusValueRangeError } from '../lib/codec';
import {
	ModbusConnectionError,
	ModbusEndpointUnavailableError,
	ModbusExceptionError,
	ModbusTimeoutError,
} from '../lib/errors';
import {
	ModbusReadRequest,
	ModbusTransport,
	ModbusTransportOptions,
	ModbusWriteRequest,
} from '../transport/modbus-transport';

import { ModbusConnectionsService } from './modbus-connections.service';
import { ModbusEndpointsService } from './modbus-endpoints.service';

export const MODBUS_PROBE_TRANSPORT_FACTORY = Symbol('MODBUS_PROBE_TRANSPORT_FACTORY');

export type ModbusProbeTransportFactory = (options: ModbusTransportOptions) => ModbusTransport;

export type ModbusProbeTarget =
	| { endpointId: string }
	| { host: string; port: number; framing: ModbusFraming; connectTimeoutMs?: number; requestTimeoutMs?: number };

export type ModbusProbeErrorKind = 'timeout' | 'connection' | 'unavailable' | 'exception' | 'encode';

export interface ModbusProbeError {
	kind: ModbusProbeErrorKind;
	exceptionCode: number | null;
	message: string;
}

export interface ModbusProbeReadResult {
	ok: boolean;
	values: (number | boolean)[] | null;
	error: ModbusProbeError | null;
	durationMs: number;
}

export interface ModbusProbeChannel {
	read(request: ModbusReadRequest): Promise<boolean[] | number[]>;
	write(request: ModbusWriteRequest): Promise<void>;
}

const MAX_BITS = 2000;
const MAX_REGISTERS = 125;
const ADDRESS_SPACE = 65536;

const validationError = (field: string, reason: string): ModbusValidationException =>
	new ModbusValidationException([JSON.stringify({ field, reason })]);

/** Turns a transport/codec failure into a probe outcome. Anything unexpected is rethrown so it surfaces as a 500. */
export function toProbeError(error: unknown): ModbusProbeError {
	if (error instanceof ModbusTimeoutError) {
		return { kind: 'timeout', exceptionCode: null, message: error.message };
	}

	if (error instanceof ModbusConnectionError) {
		return { kind: 'connection', exceptionCode: null, message: error.message };
	}

	if (error instanceof ModbusEndpointUnavailableError) {
		return { kind: 'unavailable', exceptionCode: null, message: error.message };
	}

	if (error instanceof ModbusExceptionError) {
		return { kind: 'exception', exceptionCode: error.code, message: error.message };
	}

	if (error instanceof ModbusValueRangeError) {
		return { kind: 'encode', exceptionCode: null, message: error.message };
	}

	throw error;
}

const assertReadRequest = (request: ModbusReadRequest): void => {
	const isBits =
		request.registerType === ModbusRegisterType.COIL || request.registerType === ModbusRegisterType.DISCRETE_INPUT;
	const max = isBits ? MAX_BITS : MAX_REGISTERS;

	if (!Number.isInteger(request.count) || request.count < 1 || request.count > max) {
		throw validationError('count', `Count must be between 1 and ${max} for this register type.`);
	}

	if (!Number.isInteger(request.address) || request.address < 0 || request.address >= ADDRESS_SPACE) {
		throw validationError('address', `Address must be between 0 and ${ADDRESS_SPACE - 1}.`);
	}

	if (request.address + request.count > ADDRESS_SPACE) {
		throw validationError('address', `Address plus count must not exceed ${ADDRESS_SPACE}.`);
	}
};

/**
 * Admin-initiated reads (and, via `withChannel`, writes) against an endpoint. A saved endpoint with a running
 * connection is probed through it, so no second socket is opened to a configured gateway; everything else uses a
 * one-shot transport. Only one probe per target runs at a time.
 */
@Injectable()
export class ModbusProbeService {
	private readonly active = new Set<string>();

	constructor(
		private readonly endpoints: ModbusEndpointsService,
		private readonly connections: ModbusConnectionsService,
		@Inject(MODBUS_PROBE_TRANSPORT_FACTORY) private readonly transportFactory: ModbusProbeTransportFactory,
	) {}

	async read(target: ModbusProbeTarget, request: ModbusReadRequest): Promise<ModbusProbeReadResult> {
		assertReadRequest(request);

		const start = performance.now();

		try {
			const values = await this.withChannel(target, (channel) => channel.read(request));

			return { ok: true, values, error: null, durationMs: performance.now() - start };
		} catch (error) {
			return { ok: false, values: null, error: toProbeError(error), durationMs: performance.now() - start };
		}
	}

	/** Runs `work` with a channel to the target: the running connection, or a one-shot transport closed afterwards. */
	async withChannel<T>(target: ModbusProbeTarget, work: (channel: ModbusProbeChannel) => Promise<T>): Promise<T> {
		const key = this.keyOf(target);

		// Claimed synchronously, before any await, so two concurrent probes cannot both pass the check.
		if (this.active.has(key)) {
			throw new ModbusProbeBusyException();
		}

		this.active.add(key);

		try {
			return await this.run(target, work);
		} finally {
			this.active.delete(key);
		}
	}

	private keyOf(target: ModbusProbeTarget): string {
		return 'endpointId' in target
			? `endpoint:${target.endpointId}`
			: `host:${target.host.toLowerCase()}:${target.port}`;
	}

	private async run<T>(target: ModbusProbeTarget, work: (channel: ModbusProbeChannel) => Promise<T>): Promise<T> {
		let options: ModbusTransportOptions;

		if ('endpointId' in target) {
			const endpoint = await this.endpoints.findOne(target.endpointId);

			if (!endpoint) {
				throw new ModbusEndpointNotFoundException(target.endpointId);
			}

			const connection = this.connections.get(endpoint.id);

			if (connection) {
				return work(this.guard(connection));
			}

			options = {
				host: endpoint.host,
				port: endpoint.port,
				framing: endpoint.framing,
				connectTimeoutMs: endpoint.connectTimeoutMs,
				requestTimeoutMs: endpoint.requestTimeoutMs,
			};
		} else {
			if (await this.endpoints.findByHostAndPort(target.host, target.port)) {
				throw validationError('host', 'An endpoint with this host and port already exists; probe it by endpoint_id.');
			}

			options = {
				host: target.host,
				port: target.port,
				framing: target.framing,
				connectTimeoutMs: target.connectTimeoutMs ?? MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
				requestTimeoutMs: target.requestTimeoutMs ?? MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
			};
		}

		const transport = this.transportFactory(options);

		try {
			await transport.connect();

			return await work(this.guard(transport));
		} finally {
			await transport.close().catch((): void => undefined);
		}
	}

	private guard(channel: ModbusProbeChannel): ModbusProbeChannel {
		return {
			read: (request) => {
				assertReadRequest(request);

				return channel.read(request);
			},
			write: (request) => channel.write(request),
		};
	}
}
