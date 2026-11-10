import { FastifyReply, FastifyRequest } from 'fastify';
import { Repository } from 'typeorm';

import { ArgumentsHost, NotFoundException } from '@nestjs/common';

import { BadRequestExceptionFilter } from '../../../common/filters/bad-request-exception.filter';
import { ModbusFraming } from '../devices-modbus.constants';
import { ModbusValidationException } from '../devices-modbus.exceptions';
import { ModbusDeviceEntity } from '../entities/devices-modbus.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';

import { ModbusConnectionsService } from './modbus-connections.service';
import { ModbusEndpointsService } from './modbus-endpoints.service';

describe('ModbusEndpointsService', () => {
	let endpoints: ModbusEndpointEntity[];
	let devices: Partial<ModbusDeviceEntity>[];
	let connections: { reconcile: jest.Mock; getHealth: jest.Mock };
	let service: ModbusEndpointsService;
	let nextId: number;

	beforeEach(() => {
		endpoints = [];
		devices = [];
		nextId = 1;
		connections = { reconcile: jest.fn().mockResolvedValue(undefined), getHealth: jest.fn() };

		const repository = {
			find: jest.fn(() => Promise.resolve([...endpoints])),
			findOne: jest.fn(({ where }: { where: Partial<ModbusEndpointEntity> }) =>
				Promise.resolve(
					endpoints.find((e) => Object.entries(where).every(([k, v]) => e[k as keyof ModbusEndpointEntity] === v)) ??
						null,
				),
			),
			create: jest.fn((data: Partial<ModbusEndpointEntity>) => Object.assign(new ModbusEndpointEntity(), data)),
			save: jest.fn((entity: ModbusEndpointEntity) => {
				if (!entity.id) {
					entity.id = `endpoint-${nextId++}`;
					endpoints.push(entity);
				}

				return Promise.resolve(entity);
			}),
			remove: jest.fn((entity: ModbusEndpointEntity) => {
				endpoints = endpoints.filter((e) => e.id !== entity.id);

				return Promise.resolve(entity);
			}),
		};
		const devicesRepository = {
			find: jest.fn(({ where }: { where: { endpointId: string } }) =>
				Promise.resolve(devices.filter((d) => d.endpointId === where.endpointId)),
			),
		};

		service = new ModbusEndpointsService(
			repository as unknown as Repository<ModbusEndpointEntity>,
			devicesRepository as unknown as Repository<ModbusDeviceEntity>,
			connections as unknown as ModbusConnectionsService,
		);
	});

	it('applies framing defaults', async () => {
		const saved = await service.create({
			name: 'Gateway',
			host: '10.10.0.10',
			framing: ModbusFraming.RTU_OVER_TCP,
			max_in_flight: 4,
		});

		expect(saved).toMatchObject({ maxInFlight: 1, interRequestDelayMs: 20, port: 502, connectTimeoutMs: 2000 });
	});

	it('rejects duplicate host and port', async () => {
		await service.create({ name: 'A', host: '10.10.0.10' });

		await expect(service.create({ name: 'B', host: '10.10.0.10', port: 502 })).rejects.toBeInstanceOf(
			ModbusValidationException,
		);
		await expect(service.create({ name: 'C', host: '10.10.0.10', port: 503 })).resolves.toBeDefined();
	});

	it('finds an endpoint by host and port, ignoring the host case', async () => {
		const endpoint = await service.create({ name: 'A', host: 'Gateway.local', port: 503 });

		await expect(service.findByHostAndPort('gateway.LOCAL', 503)).resolves.toBe(endpoint);
		await expect(service.findByHostAndPort('gateway.local', 502)).resolves.toBeNull();
	});

	it('refuses to delete an endpoint in use', async () => {
		const endpoint = await service.create({ name: 'A', host: '10.10.0.10' });

		devices.push({ name: 'Boiler meter', endpointId: endpoint.id });

		await expect(service.remove(endpoint.id)).rejects.toThrow(ModbusValidationException);
		await expect(service.remove(endpoint.id)).rejects.toMatchObject({
			response: { message: [expect.stringContaining('Boiler meter')] },
		});
		expect(endpoints).toHaveLength(1);
	});

	it('reconciles connections after changes', async () => {
		const endpoint = await service.create({ name: 'A', host: '10.10.0.10' });

		expect(connections.reconcile).toHaveBeenCalledTimes(1);

		await service.update(endpoint.id, { name: 'A2' });

		expect(connections.reconcile).toHaveBeenCalledTimes(2);

		await service.remove(endpoint.id);

		expect(connections.reconcile).toHaveBeenCalledTimes(3);
	});

	it('applies the new framing defaults on update unless a delay is supplied', async () => {
		const endpoint = await service.create({ name: 'A', host: '10.10.0.10', max_in_flight: 3 });

		expect(endpoint.maxInFlight).toBe(3);

		const rtu = await service.update(endpoint.id, { framing: ModbusFraming.RTU_OVER_TCP });

		expect(rtu).toMatchObject({ maxInFlight: 1, interRequestDelayMs: 20 });

		const explicit = await service.update(endpoint.id, { framing: ModbusFraming.TCP, inter_request_delay_ms: 5 });

		expect(explicit.interRequestDelayMs).toBe(5);
	});

	it('rejects an update that collides with another endpoint and throws not found for unknown ids', async () => {
		await service.create({ name: 'A', host: '10.10.0.10' });
		const other = await service.create({ name: 'B', host: '10.10.0.11' });

		await expect(service.update(other.id, { host: '10.10.0.10' })).rejects.toBeInstanceOf(ModbusValidationException);
		await expect(service.update(other.id, { host: '10.10.0.11', name: 'B2' })).resolves.toBeDefined();
		await expect(service.getOneOrThrow('missing')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('keeps the specific reason through BadRequestExceptionFilter', async () => {
		await service.create({ name: 'A', host: '10.10.0.10' });

		const error = await service.create({ name: 'B', host: '10.10.0.10' }).catch((e: unknown) => e);

		const send = jest.fn();
		const reply = { code: jest.fn().mockReturnThis(), type: jest.fn().mockReturnThis(), send };
		const host = {
			switchToHttp: () => ({
				getRequest: () => ({ originalUrl: '/x', method: 'POST' }) as unknown as FastifyRequest,
				getResponse: () => reply as unknown as FastifyReply,
			}),
		} as unknown as ArgumentsHost;

		new BadRequestExceptionFilter().catch(error as ModbusValidationException, host);

		expect((send.mock.calls[0] as [{ error: { details: unknown } }])[0].error.details).toEqual([
			{ field: 'host', reason: 'Another endpoint already uses 10.10.0.10:502.' },
		]);
	});

	it('still succeeds and logs when reconcile fails after commit', async () => {
		connections.reconcile.mockRejectedValue(new Error('boom'));
		const logError = jest.spyOn(Object.getPrototypeOf((service as unknown as { logger: object }).logger), 'error');
		logError.mockImplementation(() => undefined);

		const saved = await service.create({ name: 'A', host: '10.10.0.10' });

		expect(saved.id).toBeDefined();
		expect(endpoints).toHaveLength(1);
		expect(logError).toHaveBeenCalledWith(expect.stringContaining(saved.id), expect.anything());

		await expect(service.update(saved.id, { name: 'A2' })).resolves.toBeDefined();
		await expect(service.remove(saved.id)).resolves.toBeUndefined();

		logError.mockRestore();
	});
});
