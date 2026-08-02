/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: Asserting on a jest mock reads the method off the mocked repository,
which this rule flags even though there is no `this` binding involved.
*/
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType } from '../../spaces/spaces.constants';
import { DevicesNotAllowedException } from '../devices.exceptions';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import { DeviceEntity } from '../entities/devices.entity';

import { DeviceZonesService } from './device-zones.service';

describe('DeviceZonesService', () => {
	let service: DeviceZonesService;
	let repository: Repository<DeviceZoneEntity>;
	let deviceRepository: Repository<DeviceEntity>;
	let spaceRepository: Repository<SpaceEntity>;

	const deviceId = uuid().toString();
	const zoneId = uuid().toString();

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn((value: unknown) => value),
			save: jest.fn((value: unknown) => Promise.resolve(value)),
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DeviceZonesService,
				{ provide: getRepositoryToken(DeviceZoneEntity), useFactory: mockRepository },
				{ provide: getRepositoryToken(DeviceEntity), useFactory: mockRepository },
				{ provide: getRepositoryToken(SpaceEntity), useFactory: mockRepository },
				{ provide: EventEmitter2, useValue: { emit: jest.fn() } },
			],
		}).compile();

		service = module.get<DeviceZonesService>(DeviceZonesService);
		repository = module.get<Repository<DeviceZoneEntity>>(getRepositoryToken(DeviceZoneEntity));
		deviceRepository = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
		spaceRepository = module.get<Repository<SpaceEntity>>(getRepositoryToken(SpaceEntity));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// `POST|DELETE /devices/:id/zones/:zoneId` change placement without going through
	// `DevicesService.update()`, so the guard there does not see them. Left unguarded they are a way
	// around it: a client refused a `zone_ids` PATCH on a hidden device could reach the same end state
	// one membership at a time. A hidden device is inert — changing its placement means unhiding first.
	describe('zone membership on a hidden device', () => {
		const arrangeDevice = (hidden: boolean): void => {
			jest.spyOn(deviceRepository, 'findOne').mockResolvedValue({ id: deviceId, hidden } as DeviceEntity);
			jest.spyOn(spaceRepository, 'findOne').mockResolvedValue({ id: zoneId, type: SpaceType.ZONE } as SpaceEntity);
		};

		it('refuses adding a hidden device to a zone', async () => {
			arrangeDevice(true);

			await expect(service.addDeviceToZone(deviceId, zoneId)).rejects.toThrow(DevicesNotAllowedException);

			expect(repository.save).not.toHaveBeenCalled();
		});

		it('adds a visible device to a zone', async () => {
			arrangeDevice(false);

			await service.addDeviceToZone(deviceId, zoneId);

			expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ deviceId, zoneId }));
		});

		it('refuses removing a hidden device from a zone', async () => {
			arrangeDevice(true);

			await expect(service.removeDeviceFromZone(deviceId, zoneId)).rejects.toThrow(DevicesNotAllowedException);

			expect(repository.delete).not.toHaveBeenCalled();
		});

		it('removes a visible device from a zone', async () => {
			arrangeDevice(false);

			await service.removeDeviceFromZone(deviceId, zoneId);

			expect(repository.delete).toHaveBeenCalledWith({ deviceId, zoneId });
		});
	});
});
