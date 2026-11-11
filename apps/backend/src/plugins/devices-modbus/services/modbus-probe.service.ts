import { Inject, Injectable } from '@nestjs/common';

import {
	MODBUS_DEFAULTS,
	ModbusByteOrder,
	ModbusDataType,
	ModbusFraming,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusProbeBusyException, ModbusValidationException } from '../devices-modbus.exceptions';
import { ModbusValueMapEntry } from '../entities/modbus-binding.entity';
import {
	ModbusPropertyValue,
	ModbusValueOptions,
	ModbusValueRangeError,
	decodeBit,
	decodeRegisters,
	encodeValue,
	registerSpan,
} from '../lib/codec';
import {
	ModbusConnectionError,
	ModbusEndpointUnavailableError,
	ModbusExceptionError,
	ModbusTimeoutError,
} from '../lib/errors';
import { ReadBlock, ReadLimits, planReadBlocks, sliceForPoint, splitBlock } from '../lib/read-planner';
import { readLimitIssue } from '../lib/structure-validation';
import { selectWriteFunction } from '../lib/write-function';
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

export interface ModbusProbeBinding {
	registerType: ModbusRegisterType;
	address: number;
	dataType: ModbusDataType;
	bit: number | null;
	byteOrder: ModbusByteOrder | null;
	wordOrder: ModbusByteOrder | null;
	scale: number;
	offset: number;
	invert: boolean;
	valueMap: ModbusValueMapEntry[] | null;
	writeFunction: ModbusWriteFunction | null;
}

export interface ModbusProbePoint {
	key: string;
	binding: ModbusProbeBinding;
}

export interface ModbusProbePointsOptions {
	unitId: number;
	byteOrder: ModbusByteOrder;
	wordOrder: ModbusByteOrder;
	limits: ReadLimits;
}

export interface ModbusProbePointResult {
	key: string;
	raw: (number | boolean)[] | null;
	value: string | number | boolean | null;
	error: ModbusProbeError | null;
}

export interface ModbusProbePointsResult {
	ok: boolean;
	points: ModbusProbePointResult[];
	error: ModbusProbeError | null;
	durationMs: number;
}

export interface ModbusProbeWriteResult {
	ok: boolean;
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
const MAX_POINTS = 256;

const isBitType = (registerType: ModbusRegisterType): boolean =>
	registerType === ModbusRegisterType.COIL || registerType === ModbusRegisterType.DISCRETE_INPUT;

const spanOf = (binding: ModbusProbeBinding): number =>
	isBitType(binding.registerType) ? 1 : registerSpan(binding.dataType);

const valueOptions = (
	binding: ModbusProbeBinding,
	defaults: { byteOrder: ModbusByteOrder; wordOrder: ModbusByteOrder },
): ModbusValueOptions => ({
	dataType: binding.dataType,
	byteOrder: binding.byteOrder ?? defaults.byteOrder,
	wordOrder: binding.wordOrder ?? defaults.wordOrder,
	bit: binding.bit,
	invert: binding.invert,
	scale: binding.scale,
	offset: binding.offset,
	valueMap: binding.valueMap,
});

const failure = (kind: ModbusProbeErrorKind, message: string): ModbusProbeError => ({
	kind,
	exceptionCode: null,
	message,
});

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

	/**
	 * Reads many bindings in as few requests as the limits allow, all inside one channel. A block that fails with a
	 * request exception is retried once as per-point reads; a timeout, connection or availability failure fails the block and every remaining one and stops the batch; other failures fail just that block's points.
	 */
	async readPoints(
		target: ModbusProbeTarget,
		points: ModbusProbePoint[],
		options: ModbusProbePointsOptions,
	): Promise<ModbusProbePointsResult> {
		if (points.length > MAX_POINTS) {
			throw validationError('points', `At most ${MAX_POINTS} points can be read at once.`);
		}

		for (const { binding } of points) {
			if (
				!Number.isInteger(binding.address) ||
				binding.address < 0 ||
				binding.address + spanOf(binding) > ADDRESS_SPACE
			) {
				throw validationError('points', `Point addresses must be between 0 and ${ADDRESS_SPACE - 1}.`);
			}
		}

		// The planner never splits a value, so a point wider than the register limit would be read with more registers
		// than the caller allows. The device structure refuses the same combination.
		const limitIssue = readLimitIssue(
			options.limits.maxRegisters,
			points.map(({ binding }) => ({ registerType: binding.registerType, dataType: binding.dataType })),
		);

		if (limitIssue) {
			throw validationError(limitIssue.field, limitIssue.reason);
		}

		const start = performance.now();
		const results: ModbusProbePointResult[] = points.map(({ key }) => ({
			key,
			raw: null,
			value: null,
			error: null,
		}));

		// A transport failure that stopped the batch is the batch's error too, even when earlier blocks were read.
		let stoppedBy: ModbusProbeError | null = null;

		try {
			await this.withChannel(target, async (channel) => {
				const blocks = planReadBlocks(
					points.map(({ binding }, index) => ({
						key: String(index),
						registerType: binding.registerType,
						address: binding.address,
						span: spanOf(binding),
					})),
					options.limits,
				);

				for (const block of blocks) {
					const fatal = await this.readBlock(channel, block, points, results, options);

					if (fatal) {
						stoppedBy = fatal;

						// Stop at the first transport failure (as the poller does): continuing would reset an rtu_over_tcp
						// socket per block, and a late reply could be decoded as the next block's answer.
						for (const result of results) {
							if (result.raw === null && result.error === null) {
								result.error = fatal;
							}
						}

						break;
					}
				}
			});
		} catch (error) {
			const probeError = toProbeError(error);

			for (const result of results) {
				result.raw = null;
				result.value = null;
				result.error = probeError;
			}

			return { ok: false, points: results, error: probeError, durationMs: performance.now() - start };
		}

		return {
			ok: results.some((result) => result.error === null && result.value !== null),
			points: results,
			error: stoppedBy,
			durationMs: performance.now() - start,
		};
	}

	/** Encodes `value` through the binding and sends it. Nothing is sent when the value cannot be encoded. */
	async write(
		target: ModbusProbeTarget,
		unitId: number,
		binding: ModbusProbeBinding,
		value: ModbusPropertyValue,
		defaults: { byteOrder: ModbusByteOrder; wordOrder: ModbusByteOrder },
	): Promise<ModbusProbeWriteResult> {
		if (
			binding.registerType !== ModbusRegisterType.COIL &&
			binding.registerType !== ModbusRegisterType.HOLDING_REGISTER
		) {
			throw validationError('register_type', 'Only coils and holding registers can be written.');
		}

		if (
			!Number.isInteger(binding.address) ||
			binding.address < 0 ||
			binding.address + spanOf(binding) > ADDRESS_SPACE
		) {
			throw validationError('address', `Address plus length must not exceed ${ADDRESS_SPACE}.`);
		}

		// Unit 0 on an RTU bus is a broadcast: every slave executes the write and none answers. The device platform
		// refuses the same case; a test write that names one unit must never reach every unit on the bus.
		if (unitId === 0 && (await this.framingOf(target)) === ModbusFraming.RTU_OVER_TCP) {
			throw validationError('unit_id', 'Unit 0 on an rtu_over_tcp endpoint is a broadcast and cannot be written.');
		}

		const start = performance.now();
		const registerType = binding.registerType;

		let values: boolean[] | number[];

		try {
			const encoded = encodeValue(
				value,
				valueOptions(binding, defaults),
				registerType === ModbusRegisterType.COIL ? 'bit' : 'registers',
			);

			values = encoded.kind === 'bit' ? [encoded.value] : encoded.words;
		} catch (error) {
			return { ok: false, error: toProbeError(error), durationMs: performance.now() - start };
		}

		try {
			await this.withChannel(target, (channel) =>
				channel.write({
					unitId,
					registerType,
					address: binding.address,
					values,
					writeFunction: selectWriteFunction(binding.writeFunction, values.length),
				}),
			);

			return { ok: true, error: null, durationMs: performance.now() - start };
		} catch (error) {
			return { ok: false, error: toProbeError(error), durationMs: performance.now() - start };
		}
	}

	private async framingOf(target: ModbusProbeTarget): Promise<ModbusFraming> {
		return 'endpointId' in target ? (await this.endpoints.getOneOrThrow(target.endpointId)).framing : target.framing;
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

	private async readBlock(
		channel: ModbusProbeChannel,
		block: ReadBlock,
		points: ModbusProbePoint[],
		results: ModbusProbePointResult[],
		options: ModbusProbePointsOptions,
	): Promise<ModbusProbeError | null> {
		try {
			const values = await channel.read({
				unitId: options.unitId,
				registerType: block.registerType,
				address: block.address,
				count: block.count,
			});

			for (const planned of block.points) {
				this.decodePoint(points, results, Number(planned.key), sliceForPoint(block, values, planned), options);
			}

			return null;
		} catch (error) {
			if (error instanceof ModbusExceptionError && error.isRequestError && !this.isSplit(block)) {
				for (const part of splitBlock(block)) {
					const fatal = await this.readBlock(channel, part, points, results, options);

					if (fatal) {
						return fatal;
					}
				}

				return null;
			}

			const probeError = toProbeError(error);

			for (const planned of block.points) {
				results[Number(planned.key)].error = probeError;
			}

			return probeError.kind === 'timeout' || probeError.kind === 'connection' || probeError.kind === 'unavailable'
				? probeError
				: null;
		}
	}

	/** A block of one point (or of points sharing one address and span) cannot be split any further. */
	private isSplit(block: ReadBlock): boolean {
		return splitBlock(block).length === 1;
	}

	private decodePoint(
		points: ModbusProbePoint[],
		results: ModbusProbePointResult[],
		index: number,
		raw: (number | boolean)[],
		options: ModbusProbePointsOptions,
	): void {
		const { binding } = points[index];
		const result = results[index];

		result.raw = raw;

		try {
			const value = isBitType(binding.registerType)
				? decodeBit(raw[0] === true, binding)
				: decodeRegisters(raw as number[], valueOptions(binding, options));

			if (value === null) {
				result.error = failure(
					'encode',
					binding.valueMap ? `Raw value is not in the value map` : 'Value is not a finite number',
				);
			} else {
				result.value = value;
			}
		} catch (error) {
			result.error = toProbeError(error);
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
			const endpoint = await this.endpoints.getOneOrThrow(target.endpointId);
			const connection = this.connections.get(endpoint.id);

			if (connection) {
				return work(this.guard(connection, connection.framing));
			}

			// The runtime owns the socket of an enabled endpoint; a second one could upset a single-connection gateway.
			if (endpoint.enabled && this.connections.isAttached()) {
				throw new ModbusEndpointUnavailableError('Endpoint connection is not running yet; try again shortly.');
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

		// Accepted race: a one-shot probe of a disabled endpoint that is still running when the endpoint gets enabled can
		// briefly coexist with the new runtime connection.
		const transport = this.transportFactory(options);

		try {
			await transport.connect();

			return await work(this.guard(transport, options.framing));
		} finally {
			await transport.close().catch((): void => undefined);
		}
	}

	/**
	 * Checks every request against the framing of the channel that will carry it. The unit-0 check here covers the
	 * window in which an endpoint's saved framing was already changed but the runtime still runs the old connection.
	 */
	private guard(channel: ModbusProbeChannel, framing: ModbusFraming): ModbusProbeChannel {
		return {
			read: (request) => {
				assertReadRequest(request);

				return channel.read(request);
			},
			write: (request) => {
				if (request.unitId === 0 && framing === ModbusFraming.RTU_OVER_TCP) {
					return Promise.reject(
						validationError('unit_id', 'Unit 0 on an rtu_over_tcp endpoint is a broadcast and cannot be written.'),
					);
				}

				return channel.write(request);
			},
		};
	}
}
