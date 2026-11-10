import { MODBUS_DEFAULTS, ModbusFraming, ModbusRegisterType } from '../devices-modbus.constants';
import {
	ModbusEndpointNotFoundException,
	ModbusProbeBusyException,
	ModbusValidationException,
} from '../devices-modbus.exceptions';
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
import { ModbusProbeService, toProbeError } from './modbus-probe.service';

const request: ModbusReadRequest = {
	unitId: 1,
	registerType: ModbusRegisterType.HOLDING_REGISTER,
	address: 10,
	count: 2,
};

describe('ModbusProbeService', () => {
	let calls: string[];
	let transport: { [K in keyof ModbusTransport]: jest.Mock };
	let factory: jest.Mock;
	let running: { read: jest.Mock; write: jest.Mock } | null;
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
		saved = Object.assign(new ModbusEndpointEntity(), {
			id: 'ep-1',
			host: 'Gateway.local',
			port: 502,
			framing: ModbusFraming.RTU_OVER_TCP,
			connectTimeoutMs: 1500,
			requestTimeoutMs: 700,
		});

		const endpoints = {
			findOne: jest.fn((id: string) => Promise.resolve(id === saved.id ? saved : null)),
			findByHostAndPort: jest.fn((host: string, port: number) =>
				Promise.resolve(host.toLowerCase() === saved.host.toLowerCase() && port === saved.port ? saved : null),
			),
		};
		const connections = { get: jest.fn(() => running) };

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

	it('throws not found for an unknown endpoint id', async () => {
		await expect(service.read({ endpointId: 'nope' }, request)).rejects.toBeInstanceOf(ModbusEndpointNotFoundException);
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
});
