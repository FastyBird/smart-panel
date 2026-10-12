/* eslint-disable @typescript-eslint/unbound-method */
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { RoomSpaceEntity } from '../entities/room-space.entity';
import { ZoneSpaceEntity } from '../entities/zone-space.entity';

import { HomeControlSpacesService } from './home-control-spaces.service';

describe('HomeControlSpacesService', () => {
	let service: HomeControlSpacesService;
	let deviceRepository: jest.Mocked<Repository<DeviceEntity>>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeControlSpacesService,
				{
					provide: getRepositoryToken(DeviceEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn().mockReturnValue({
							find: jest.fn().mockResolvedValue([]),
						}),
					},
				},
				{
					provide: SpacesService,
					useValue: {
						getOneOrThrow: jest.fn(),
						findOne: jest.fn(),
					},
				},
				SpacesTypeMapperService,
			],
		}).compile();

		service = module.get<HomeControlSpacesService>(HomeControlSpacesService);
		deviceRepository = module.get(getRepositoryToken(DeviceEntity));

		// Pre-register Room/Zone mappings (normally done by SpacesHomeControlPlugin.onModuleInit)
		const typeMapper = module.get<SpacesTypeMapperService>(SpacesTypeMapperService);
		typeMapper.registerMapping({
			type: SpaceType.ROOM,
			class: RoomSpaceEntity,
			createDto: class {} as never,
			updateDto: class {} as never,
		});
		typeMapper.registerMapping({
			type: SpaceType.ZONE,
			class: ZoneSpaceEntity,
			createDto: class {} as never,
			updateDto: class {} as never,
		});
	});

	describe('proposeSpaces', () => {
		it('should return empty array when no devices exist', async () => {
			deviceRepository.find.mockResolvedValue([]);

			const result = await service.proposeSpaces();

			expect(result).toEqual([]);
			expect(deviceRepository.find).toHaveBeenCalledWith({ select: ['id', 'name'] });
		});

		it('should propose spaces based on device names', async () => {
			const devices = [
				{ id: uuid(), name: 'Living Room Ceiling Light' },
				{ id: uuid(), name: 'Living Room Lamp' },
				{ id: uuid(), name: 'Kitchen Light' },
				{ id: uuid(), name: 'Bedroom Thermostat' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(3);

			const livingRoom = result.find((s) => s.name === 'Living Room');
			expect(livingRoom).toBeDefined();
			expect(livingRoom?.deviceCount).toBe(2);
			expect(livingRoom?.deviceIds).toContain(devices[0].id);
			expect(livingRoom?.deviceIds).toContain(devices[1].id);

			const kitchen = result.find((s) => s.name === 'Kitchen');
			expect(kitchen).toBeDefined();
			expect(kitchen?.deviceCount).toBe(1);

			const bedroom = result.find((s) => s.name === 'Bedroom');
			expect(bedroom).toBeDefined();
			expect(bedroom?.deviceCount).toBe(1);
		});

		it('should not propose spaces for devices without room tokens', async () => {
			const devices = [
				{ id: uuid(), name: 'Main Switch' },
				{ id: uuid(), name: 'Temperature Sensor' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toEqual([]);
		});

		it('should match longest room token when multiple match', async () => {
			const devices = [{ id: uuid(), name: 'Master Bedroom Light' }] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Master Bedroom');
		});

		it('should handle case-insensitive matching', async () => {
			const devices = [
				{ id: uuid(), name: 'LIVING ROOM Lamp' },
				{ id: uuid(), name: 'living room light' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Living Room');
			expect(result[0].deviceCount).toBe(2);
		});
	});
});
