import { NotFoundException } from '@nestjs/common';

import {
	MODBUS_DEFAULTS,
	ModbusByteOrder,
	ModbusDataType,
	ModbusFraming,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusProbeBusyException, ModbusValidationException } from '../devices-modbus.exceptions';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import {
	ModbusConnectionError,
	ModbusEndpointUnavailableError,
	ModbusExceptionError,
	ModbusTimeoutError,
} from '../lib/errors';
import { ModbusReadRequest, ModbusTransport, ModbusTransportOptions } from '../transport/modbus-transport';

import { ModbusConnectionsService } from './modbus-connections.service';
import { ModbusEndpointsService } from './modbus-endpoints.service';
import {
	ModbusProbeBinding,
	ModbusProbePoint,
	ModbusProbePointsOptions,
	ModbusProbeService,
	toProbeError,
} from './modbus-probe.service';

const request: ModbusReadRequest = {
	unitId: 1,
	registerType: ModbusRegisterType.HOLDING_REGISTER,
	address: 10,
	count: 2,
};

const defaults = { byteOrder: ModbusByteOrder.BIG, wordOrder: ModbusByteOrder.BIG };
const pointsOptions: ModbusProbePointsOptions = {
	unitId: 1,
	...defaults,
	limits: { maxRegisters: 125, maxBits: 2000, maxGap: 0 },
};
const binding = (patch: Partial<ModbusProbeBinding>): ModbusProbeBinding => ({
	registerType: ModbusRegisterType.HOLDING_REGISTER,
	address: 0,
	dataType: ModbusDataType.UINT16,
	bit: null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	...patch,
});
const point = (key: string, address: number, patch: Partial<ModbusProbeBinding> = {}): ModbusProbePoint => ({
	key,
	binding: binding({ address, ...patch }),
});
const relay = binding({
	address: 20,
	valueMap: [
		{ raw: 0, value: false },
		{ raw: 256, value: true },
	],
	writeFunction: ModbusWriteFunction.SINGLE,
});

describe('ModbusProbeService', () => {
	let calls: string[];
	let transport: { [K in keyof ModbusTransport]: jest.Mock };
	let factory: jest.Mock;
	let running: { read: jest.Mock; write: jest.Mock; framing?: ModbusFraming } | null;
	let attached: boolean;
	let saved: ModbusEndpointEntity;
	let service: ModbusProbeService;

	beforeEach(() => {
		calls = [];
		transport = {
			connect: jest.fn(() => {
				calls.push('connect');

				return Promise.resolve();
			}),
			read: jest.fn(() => {
				calls.push('read');

				return Promise.resolve([1, 2]);
			}),
			write: jest.fn(() => Promise.resolve()),
			close: jest.fn(() => {
				calls.push('close');

				return Promise.resolve();
			}),
			isOpen: jest.fn(() => true),
			onClose: jest.fn(),
		};
		factory = jest.fn((_options: ModbusTransportOptions) => transport as unknown as ModbusTransport);
		running = null;
		attached = false;
		saved = Object.assign(new ModbusEndpointEntity(), {
			id: 'ep-1',
			enabled: true,
			host: 'Gateway.local',
			port: 502,
			framing: ModbusFraming.RTU_OVER_TCP,
			connectTimeoutMs: 1500,
			requestTimeoutMs: 700,
		});

		const endpoints = {
			getOneOrThrow: jest.fn((id: string) =>
				id === saved.id
					? Promise.resolve(saved)
					: Promise.reject(new NotFoundException('Requested endpoint does not exist')),
			),
			findByHostAndPort: jest.fn((host: string, port: number) =>
				Promise.resolve(host.toLowerCase() === saved.host.toLowerCase() && port === saved.port ? saved : null),
			),
		};
		const connections = { get: jest.fn(() => running), isAttached: jest.fn(() => attached) };

		service = new ModbusProbeService(
			endpoints as unknown as ModbusEndpointsService,
			connections as unknown as ModbusConnectionsService,
			factory,
		);
	});

	it('probes a running endpoint through its connection', async () => {
		running = { read: jest.fn().mockResolvedValue([5, 6]), write: jest.fn() };

		const result = await service.read({ endpointId: 'ep-1' }, request);

		expect(running.read).toHaveBeenCalledWith(request);
		expect(factory).not.toHaveBeenCalled();
		expect(result).toMatchObject({ ok: true, values: [5, 6], error: null });
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it('uses a one-shot transport for a saved endpoint without a running connection', async () => {
		const result = await service.read({ endpointId: 'ep-1' }, request);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(factory).toHaveBeenCalledWith({
			host: 'Gateway.local',
			port: 502,
			framing: ModbusFraming.RTU_OVER_TCP,
			connectTimeoutMs: 1500,
			requestTimeoutMs: 700,
		});
		expect(calls).toEqual(['connect', 'read', 'close']);
		expect(result).toMatchObject({ ok: true, values: [1, 2] });
	});

	it('closes the one-shot transport when the read throws', async () => {
		transport.read.mockRejectedValue(new ModbusTimeoutError());

		const result = await service.read({ endpointId: 'ep-1' }, request);

		expect(calls).toEqual(['connect', 'close']);
		expect(result).toMatchObject({ ok: false, values: null, error: { kind: 'timeout' } });
	});

	it('uses a one-shot transport for unsaved details', async () => {
		await service.read({ host: '10.0.0.9', port: 1502, framing: ModbusFraming.TCP }, request);

		expect(factory).toHaveBeenCalledWith({
			host: '10.0.0.9',
			port: 1502,
			framing: ModbusFraming.TCP,
			connectTimeoutMs: MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
			requestTimeoutMs: MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
		});

		await service.read(
			{ host: '10.0.0.9', port: 1502, framing: ModbusFraming.TCP, connectTimeoutMs: 300, requestTimeoutMs: 400 },
			request,
		);

		expect(factory).toHaveBeenLastCalledWith(expect.objectContaining({ connectTimeoutMs: 300, requestTimeoutMs: 400 }));
	});

	it('refuses unsaved details that match a saved endpoint', async () => {
		const attempt = service.read({ host: 'GATEWAY.local', port: 502, framing: ModbusFraming.TCP }, request);

		await expect(attempt).rejects.toBeInstanceOf(ModbusValidationException);
		await expect(attempt).rejects.toMatchObject({
			response: { message: [expect.stringContaining('"field":"host"')] },
		});
		expect(factory).not.toHaveBeenCalled();
	});

	it('does not open a second socket to an enabled endpoint while the runtime is attached', async () => {
		attached = true;

		const read = await service.read({ endpointId: 'ep-1' }, request);

		expect(factory).not.toHaveBeenCalled();
		expect(read).toMatchObject({
			ok: false,
			values: null,
			error: { kind: 'unavailable', message: 'Endpoint connection is not running yet; try again shortly.' },
		});

		const write = await service.write({ endpointId: 'ep-1' }, 1, relay, true, defaults);

		expect(write).toMatchObject({ ok: false, error: { kind: 'unavailable' } });

		const points = await service.readPoints({ endpointId: 'ep-1' }, [point('a', 10)], pointsOptions);

		expect(points).toMatchObject({ ok: false, error: { kind: 'unavailable' } });
		expect(points.points[0].error).toMatchObject({ kind: 'unavailable' });
		expect(factory).not.toHaveBeenCalled();
	});

	it('uses a one-shot transport for a disabled endpoint while attached', async () => {
		attached = true;
		saved.enabled = false;

		const result = await service.read({ endpointId: 'ep-1' }, request);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({ ok: true });
	});

	it('throws not found for an unknown endpoint id', async () => {
		await expect(service.read({ endpointId: 'nope' }, request)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('maps failures to probe errors', async () => {
		const cases: [Error, object][] = [
			[new ModbusTimeoutError(), { kind: 'timeout', exceptionCode: null }],
			[new ModbusConnectionError('ECONNREFUSED'), { kind: 'connection', exceptionCode: null }],
			[new ModbusEndpointUnavailableError(), { kind: 'unavailable', exceptionCode: null }],
			[new ModbusExceptionError(2), { kind: 'exception', exceptionCode: 2 }],
		];

		for (const [error, expected] of cases) {
			transport.read.mockRejectedValueOnce(error);

			const result = await service.read({ endpointId: 'ep-1' }, request);

			expect(result).toMatchObject({ ok: false, values: null, error: expected });
			expect(result.error?.message).toBe(error.message);
		}

		transport.connect.mockRejectedValueOnce(new ModbusConnectionError('refused'));

		await expect(service.read({ endpointId: 'ep-1' }, request)).resolves.toMatchObject({
			ok: false,
			error: { kind: 'connection' },
		});
	});

	it('rethrows unknown errors', () => {
		expect(() => toProbeError(new Error('boom'))).toThrow('boom');
	});

	it('rejects a second probe to the same target while one runs', async () => {
		let release: () => void = () => undefined;

		transport.read.mockImplementationOnce(
			() =>
				new Promise<number[]>((resolve) => {
					release = () => resolve([1, 2]);
				}),
		);

		const first = service.read({ endpointId: 'ep-1' }, request);

		await expect(service.read({ endpointId: 'ep-1' }, request)).rejects.toBeInstanceOf(ModbusProbeBusyException);
		await expect(
			service.read({ host: '10.0.0.9', port: 502, framing: ModbusFraming.TCP }, request),
		).resolves.toMatchObject({ ok: true });

		release();
		await expect(first).resolves.toMatchObject({ ok: true });
		await expect(service.read({ endpointId: 'ep-1' }, request)).resolves.toMatchObject({ ok: true });
	});

	it('releases the target when the work fails', async () => {
		await expect(service.withChannel({ endpointId: 'ep-1' }, () => Promise.reject(new Error('boom')))).rejects.toThrow(
			'boom',
		);
		await expect(service.read({ endpointId: 'ep-1' }, request)).resolves.toMatchObject({ ok: true });
	});

	it('rejects counts beyond the protocol limits', async () => {
		const target = { endpointId: 'ep-1' };
		const invalid: [Partial<ModbusReadRequest>, string][] = [
			[{ registerType: ModbusRegisterType.HOLDING_REGISTER, count: 126 }, 'count'],
			[{ registerType: ModbusRegisterType.INPUT_REGISTER, count: 0 }, 'count'],
			[{ registerType: ModbusRegisterType.COIL, count: 2001 }, 'count'],
			[{ address: 65500, count: 100 }, 'address'],
			[{ address: -1 }, 'address'],
		];

		for (const [patch, field] of invalid) {
			await expect(service.read(target, { ...request, ...patch })).rejects.toMatchObject({
				response: { message: [expect.stringContaining(`"field":"${field}"`)] },
			});
		}

		await expect(
			service.read(target, { ...request, registerType: ModbusRegisterType.COIL, count: 2000 }),
		).resolves.toMatchObject({ ok: true });
		expect(factory).toHaveBeenCalledTimes(1);
	});

	describe('readPoints', () => {
		it('decodes points in planned blocks', async () => {
			transport.read.mockResolvedValueOnce([100, 0x0000, 0x4120, 7]);

			const result = await service.readPoints(
				{ endpointId: 'ep-1' },
				[
					point('a', 10),
					point('f', 11, { dataType: ModbusDataType.FLOAT32, wordOrder: ModbusByteOrder.LITTLE }),
					point('b', 13),
				],
				pointsOptions,
			);

			expect(transport.read).toHaveBeenCalledTimes(1);
			expect(transport.read).toHaveBeenCalledWith({
				unitId: 1,
				registerType: ModbusRegisterType.HOLDING_REGISTER,
				address: 10,
				count: 4,
			});
			expect(result.ok).toBe(true);
			expect(result.error).toBeNull();
			expect(result.points).toEqual([
				{ key: 'a', raw: [100], value: 100, error: null },
				{ key: 'f', raw: [0x0000, 0x4120], value: 10, error: null },
				{ key: 'b', raw: [7], value: 7, error: null },
			]);
		});

		it('splits a block once after an illegal address', async () => {
			transport.read
				.mockRejectedValueOnce(new ModbusExceptionError(2))
				.mockResolvedValueOnce([1])
				.mockRejectedValueOnce(new ModbusExceptionError(2))
				.mockResolvedValueOnce([3]);

			const result = await service.readPoints(
				{ endpointId: 'ep-1' },
				[point('a', 10), point('bad', 11), point('c', 12)],
				pointsOptions,
			);

			expect(transport.read).toHaveBeenCalledTimes(4);
			expect(result.ok).toBe(true);
			expect(result.points.map((p) => [p.key, p.value])).toEqual([
				['a', 1],
				['bad', null],
				['c', 3],
			]);
			expect(result.points[1].error).toMatchObject({ kind: 'exception', exceptionCode: 2 });
		});

		it('does not split after a non-request exception', async () => {
			transport.read.mockRejectedValueOnce(new ModbusExceptionError(6));

			const result = await service.readPoints({ endpointId: 'ep-1' }, [point('a', 10), point('b', 11)], pointsOptions);

			expect(transport.read).toHaveBeenCalledTimes(1);
			expect(result.ok).toBe(false);
			expect(result.error).toBeNull();
			expect(result.points.map((p) => p.error?.exceptionCode)).toEqual([6, 6]);
		});

		it('stops at the first timeout and fails the remaining blocks without reading them', async () => {
			transport.read.mockRejectedValueOnce(new ModbusTimeoutError('timed out'));

			const result = await service.readPoints({ endpointId: 'ep-1' }, [point('a', 10), point('b', 400)], pointsOptions);

			expect(transport.read).toHaveBeenCalledTimes(1);
			expect(result.ok).toBe(false);
			expect(result.points.map((p) => p.error?.kind)).toEqual(['timeout', 'timeout']);
			expect(result.points.every((p) => p.raw === null && p.value === null)).toBe(true);
		});

		it('keeps earlier decoded blocks when a later block times out', async () => {
			transport.read.mockResolvedValueOnce([5]).mockRejectedValueOnce(new ModbusTimeoutError('timed out'));

			const result = await service.readPoints(
				{ endpointId: 'ep-1' },
				[point('a', 10), point('b', 400), point('c', 800)],
				pointsOptions,
			);

			expect(transport.read).toHaveBeenCalledTimes(2);
			expect(result.points[0]).toEqual({ key: 'a', raw: [5], value: 5, error: null });
			expect(result.points.slice(1).map((p) => p.error?.kind)).toEqual(['timeout', 'timeout']);
		});

		it('continues to the next block after a non-request exception', async () => {
			transport.read.mockRejectedValueOnce(new ModbusExceptionError(6)).mockResolvedValueOnce([9]);

			const result = await service.readPoints({ endpointId: 'ep-1' }, [point('a', 10), point('b', 400)], pointsOptions);

			expect(transport.read).toHaveBeenCalledTimes(2);
			expect(result.points[0].error).toMatchObject({ kind: 'exception', exceptionCode: 6 });
			expect(result.points[1]).toMatchObject({ value: 9, error: null });
		});

		it('reports a value map miss per point', async () => {
			transport.read.mockResolvedValueOnce([1, 9]);

			const result = await service.readPoints(
				{ endpointId: 'ep-1' },
				[
					point('hit', 10, { valueMap: [{ raw: 1, value: 'on' }] }),
					point('miss', 11, { valueMap: [{ raw: 1, value: 'on' }] }),
				],
				pointsOptions,
			);

			expect(result.ok).toBe(true);
			expect(result.points[0]).toEqual({ key: 'hit', raw: [1], value: 'on', error: null });
			expect(result.points[1]).toMatchObject({ key: 'miss', raw: [9], value: null, error: { kind: 'encode' } });
			expect(result.points[1].error?.message).toEqual(expect.any(String));
		});

		it('fails every point when the channel fails', async () => {
			transport.connect.mockRejectedValueOnce(new ModbusConnectionError('refused'));

			const result = await service.readPoints({ endpointId: 'ep-1' }, [point('a', 10), point('b', 40)], pointsOptions);

			expect(result.ok).toBe(false);
			expect(result.error).toMatchObject({ kind: 'connection' });
			expect(result.points.every((p) => p.error?.kind === 'connection' && p.value === null)).toBe(true);
		});

		it('decodes bit points', async () => {
			transport.read.mockResolvedValueOnce([true]);

			const result = await service.readPoints(
				{ endpointId: 'ep-1' },
				[point('c', 3, { registerType: ModbusRegisterType.COIL, dataType: ModbusDataType.BOOL, invert: true })],
				pointsOptions,
			);

			expect(result.points[0]).toEqual({ key: 'c', raw: [true], value: false, error: null });
		});

		it('rejects more than 256 points and out-of-range addresses', async () => {
			const many = Array.from({ length: 257 }, (_, i) => point(`p${i}`, i));

			await expect(service.readPoints({ endpointId: 'ep-1' }, many, pointsOptions)).rejects.toMatchObject({
				response: { message: [expect.stringContaining('"field":"points"')] },
			});
			await expect(
				service.readPoints(
					{ endpointId: 'ep-1' },
					[point('x', 65535, { dataType: ModbusDataType.UINT32 })],
					pointsOptions,
				),
			).rejects.toBeInstanceOf(ModbusValidationException);
			await expect(service.readPoints({ endpointId: 'ep-1' }, [point('x', -1)], pointsOptions)).rejects.toBeInstanceOf(
				ModbusValidationException,
			);
			expect(factory).not.toHaveBeenCalled();
		});
	});

	describe('write', () => {
		it('writes a relay through its value map', async () => {
			const result = await service.write({ endpointId: 'ep-1' }, 3, relay, true, defaults);

			expect(result).toMatchObject({ ok: true, error: null });
			expect(transport.write).toHaveBeenCalledWith({
				unitId: 3,
				registerType: ModbusRegisterType.HOLDING_REGISTER,
				address: 20,
				values: [256],
				writeFunction: ModbusWriteFunction.SINGLE,
			});
			expect(calls).toEqual(['connect', 'close']);
		});

		it('uses the multiple function for a multi-word value and applies default orders', async () => {
			await service.write(
				{ endpointId: 'ep-1' },
				1,
				{ ...relay, dataType: ModbusDataType.UINT32, valueMap: null, writeFunction: null },
				0x00010002,
				{ byteOrder: ModbusByteOrder.BIG, wordOrder: ModbusByteOrder.LITTLE },
			);

			expect(transport.write).toHaveBeenCalledWith(
				expect.objectContaining({ values: [2, 1], writeFunction: ModbusWriteFunction.MULTIPLE }),
			);
		});

		it('writes a coil', async () => {
			await service.write(
				{ endpointId: 'ep-1' },
				1,
				{ ...relay, registerType: ModbusRegisterType.COIL, dataType: ModbusDataType.BOOL, valueMap: null },
				true,
				defaults,
			);

			expect(transport.write).toHaveBeenCalledWith(
				expect.objectContaining({ registerType: ModbusRegisterType.COIL, values: [true] }),
			);
		});

		it('refuses to write a bit binding', async () => {
			const result = await service.write(
				{ endpointId: 'ep-1' },
				1,
				{ ...relay, bit: 3, valueMap: null },
				true,
				defaults,
			);

			expect(result).toMatchObject({ ok: false, error: { kind: 'encode' } });
			expect(factory).not.toHaveBeenCalled();
			expect(transport.write).not.toHaveBeenCalled();
		});

		it('refuses an out-of-range value without touching the channel', async () => {
			const result = await service.write(
				{ endpointId: 'ep-1' },
				1,
				{ ...relay, valueMap: null, dataType: ModbusDataType.UINT16 },
				70000,
				defaults,
			);

			expect(result).toMatchObject({ ok: false, error: { kind: 'encode' } });
			expect(factory).not.toHaveBeenCalled();
		});

		it('refuses a broadcast write to unit 0 on an rtu over tcp endpoint', async () => {
			await expect(service.write({ endpointId: 'ep-1' }, 0, relay, true, defaults)).rejects.toMatchObject({
				response: { message: [expect.stringContaining('"field":"unit_id"')] },
			});
			await expect(
				service.write({ host: '10.0.0.9', port: 4196, framing: ModbusFraming.RTU_OVER_TCP }, 0, relay, true, defaults),
			).rejects.toMatchObject({ response: { message: [expect.stringContaining('"field":"unit_id"')] } });
			expect(factory).not.toHaveBeenCalled();
			expect(transport.write).not.toHaveBeenCalled();
		});

		it('refuses unit 0 when the running connection is still rtu over tcp after the framing was changed', async () => {
			saved.framing = ModbusFraming.TCP;
			running = { read: jest.fn(), write: jest.fn(), framing: ModbusFraming.RTU_OVER_TCP };

			await expect(service.write({ endpointId: 'ep-1' }, 0, relay, true, defaults)).rejects.toMatchObject({
				response: { message: [expect.stringContaining('"field":"unit_id"')] },
			});
			expect(running.write).not.toHaveBeenCalled();
			expect(factory).not.toHaveBeenCalled();
		});

		it('allows unit 0 on a tcp target', async () => {
			const result = await service.write(
				{ host: '10.0.0.9', port: 502, framing: ModbusFraming.TCP },
				0,
				relay,
				true,
				defaults,
			);

			expect(result).toMatchObject({ ok: true });
			expect(transport.write).toHaveBeenCalledWith(expect.objectContaining({ unitId: 0 }));
		});

		it('refuses a discrete input write target', async () => {
			await expect(
				service.write(
					{ endpointId: 'ep-1' },
					1,
					{ ...relay, registerType: ModbusRegisterType.DISCRETE_INPUT },
					true,
					defaults,
				),
			).rejects.toMatchObject({ response: { message: [expect.stringContaining('"field":"register_type"')] } });
			expect(factory).not.toHaveBeenCalled();
		});

		it('refuses a write that would run past the end of the address space', async () => {
			const wide = { ...relay, valueMap: null, dataType: ModbusDataType.UINT32, address: 65535 };

			await expect(service.write({ endpointId: 'ep-1' }, 1, wide, 1, defaults)).rejects.toMatchObject({
				response: { message: [expect.stringContaining('"field":"address"')] },
			});
			await expect(
				service.write(
					{ endpointId: 'ep-1' },
					1,
					{ ...wide, registerType: ModbusRegisterType.COIL, dataType: ModbusDataType.BOOL, address: 65536 },
					true,
					defaults,
				),
			).rejects.toMatchObject({ response: { message: [expect.stringContaining('"field":"address"')] } });
			expect(factory).not.toHaveBeenCalled();

			await expect(
				service.write({ endpointId: 'ep-1' }, 1, { ...wide, dataType: ModbusDataType.UINT16 }, 1, defaults),
			).resolves.toMatchObject({ ok: true });
		});

		it('maps a write exception to a probe error', async () => {
			transport.write.mockRejectedValueOnce(new ModbusExceptionError(4));

			const result = await service.write({ endpointId: 'ep-1' }, 1, relay, true, defaults);

			expect(result).toMatchObject({ ok: false, error: { kind: 'exception', exceptionCode: 4 } });
		});
	});
});
