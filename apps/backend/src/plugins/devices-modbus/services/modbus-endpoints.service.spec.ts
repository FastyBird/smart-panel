import { Repository } from 'typeorm';

import { NotFoundException } from '@nestjs/common';

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
			find: jest.fn(({ where }: { where: { modbusEndpointId: string } }) =>
				Promise.resolve(devices.filter((d) => d.modbusEndpointId === where.modbusEndpointId)),
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

	it('refuses to delete an endpoint in use', async () => {
		const endpoint = await service.create({ name: 'A', host: '10.10.0.10' });

		devices.push({ name: 'Boiler meter', modbusEndpointId: endpoint.id });

		await expect(service.remove(endpoint.id)).rejects.toThrow(/Boiler meter/);
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
});
