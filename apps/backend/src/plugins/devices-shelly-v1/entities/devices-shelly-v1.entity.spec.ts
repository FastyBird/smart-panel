/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesControlsService } from '../../../modules/devices/services/devices.controls.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';

import { ShellyV1DeviceEntity } from './devices-shelly-v1.entity';

// Regression coverage for the devices.service.ts:280 updateFields defect (see the Trap 1 / Trap 2
// comment at that call site), exercised against a *real* plugin entity rather than the generic
// MockDevice the core DevicesService suite uses. ShellyV1DeviceEntity is exactly the shape that
// matters here: a @ChildEntity() subclass of DeviceEntity carrying its own `password`/`hostname`
// initializers (`= null`), on top of the inherited `enabled = true`. It is also the entity that
// exposed the getter-only-inherited-property crash a naive `exposeUnsetFields: true` fix hits
// (DeviceEntity.zoneIds is a getter declared only on the base class) — these tests calling
// service.update() against ShellyV1DeviceEntity without throwing is itself part of what they prove.
describe('ShellyV1DeviceEntity via DevicesService.update()', () => {
	let service: DevicesService;
	let repository: Repository<DeviceEntity>;
	let dataSource: DataSource;

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
		find: jest.fn(),
		remove: jest.fn(),
	};

	const mockDevice = {
		id: uuid().toString(),
		type: DEVICES_SHELLY_V1_TYPE,
		category: DeviceCategory.GENERIC,
		identifier: null,
		name: 'Test Shelly Device',
		description: null,
		enabled: true,
		hidden: false,
		hiddenBy: null,
		roomId: null,
		room: null,
		deviceZones: [],
		status: {
			online: false,
			status: ConnectionState.UNKNOWN,
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
		password: null,
		hostname: null,
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DevicesService,
				{ provide: getRepositoryToken(DeviceEntity), useFactory: mockRepository },
				{ provide: getRepositoryToken(SpaceEntity), useFactory: mockRepository },
				{
					provide: DeviceZonesService,
					useValue: {
						setDeviceZones: jest.fn().mockResolvedValue([]),
						getDeviceZones: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: DevicesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: DEVICES_SHELLY_V1_TYPE,
							class: ShellyV1DeviceEntity,
							createDto: CreateShellyV1DeviceDto,
							updateDto: UpdateShellyV1DeviceDto,
						})),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						create: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findBoundedForChannels: jest.fn().mockResolvedValue({ properties: [], totals: {} }),
					},
				},
				{
					provide: DevicesControlsService,
					useValue: {
						remove: jest.fn(() => {}),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
						manager: mockManager,
						transaction: jest.fn(async (cb: (m: any) => any) => await cb(mockManager)),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<DevicesService>(DevicesService);
		repository = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
		dataSource = module.get<DataSource>(DataSource);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// Arranges a persisted device and wires the mocks so the second (post-save) getOneOrThrow() read
	// returns the same object save() was called with, mirroring the arrangement devices.service.spec.ts
	// uses for its own defect-regression tests.
	const arrangeDevice = (overrides: Record<string, unknown>): ShellyV1DeviceEntity => {
		jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

		const persisted = toInstance(ShellyV1DeviceEntity, { ...mockDevice, ...overrides });

		const queryBuilderMock: any = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			leftJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(persisted),
		};

		jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
		jest.spyOn(repository, 'save').mockResolvedValue(persisted);

		return persisted;
	};

	// This is the scenario the task that produced this fix called out by name: hiding a physical
	// device after a virtual device replaces it sends `{type, hidden, hiddenBy}`, and a device
	// discovered by the Shelly V1 plugin gets `{type, hostname}` pushed through this exact path
	// whenever its IP changes (see DeviceMapperService.doMapDevice) — neither carries `password`.
	it('leaves enabled, password, and hostname untouched when the patch only carries {type, name}', async () => {
		arrangeDevice({ enabled: false, password: 'hunter2', hostname: '192.168.1.50' });

		await service.update(mockDevice.id, {
			type: DEVICES_SHELLY_V1_TYPE,
			name: 'Renamed',
		} as UpdateShellyV1DeviceDto);

		expect(repository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				enabled: false,
				password: 'hunter2',
				hostname: '192.168.1.50',
				name: 'Renamed',
			}),
		);
	});

	it('clears password to null when the patch explicitly carries password: null', async () => {
		arrangeDevice({ password: 'hunter2', hostname: '192.168.1.50' });

		await service.update(mockDevice.id, {
			type: DEVICES_SHELLY_V1_TYPE,
			password: null,
		} as UpdateShellyV1DeviceDto);

		expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ password: null, hostname: '192.168.1.50' }));
	});

	it('updates password to a new value when the patch carries it, leaving hostname untouched', async () => {
		arrangeDevice({ password: 'oldpass', hostname: '192.168.1.50' });

		await service.update(mockDevice.id, {
			type: DEVICES_SHELLY_V1_TYPE,
			password: 'newpass',
		} as UpdateShellyV1DeviceDto);

		expect(repository.save).toHaveBeenCalledWith(
			expect.objectContaining({ password: 'newpass', hostname: '192.168.1.50' }),
		);
	});

	it('updates hostname when the patch carries it, leaving password untouched', async () => {
		arrangeDevice({ password: 'hunter2', hostname: '192.168.1.50' });

		await service.update(mockDevice.id, {
			type: DEVICES_SHELLY_V1_TYPE,
			hostname: '10.0.0.9',
		} as UpdateShellyV1DeviceDto);

		expect(repository.save).toHaveBeenCalledWith(
			expect.objectContaining({ hostname: '10.0.0.9', password: 'hunter2' }),
		);
	});

	it('applies enabled: false, a falsy value, when the patch carries it', async () => {
		arrangeDevice({ enabled: true });

		await service.update(mockDevice.id, {
			type: DEVICES_SHELLY_V1_TYPE,
			enabled: false,
		} as UpdateShellyV1DeviceDto);

		expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
	});
});
