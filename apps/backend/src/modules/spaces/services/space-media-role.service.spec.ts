import { Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceMediaRoleEntity } from '../entities/space-media-role.entity';

import { SpaceMediaRoleService } from './space-media-role.service';
import { SpacesService } from './spaces.service';

describe('SpaceMediaRoleService', () => {
	let service: SpaceMediaRoleService;
	let roleRepository: jest.Mocked<Repository<SpaceMediaRoleEntity>>;
	let deviceRepository: jest.Mocked<Repository<DeviceEntity>>;
	let spacesService: jest.Mocked<SpacesService>;

	beforeEach(() => {
		roleRepository = {
			find: jest.fn(),
		} as unknown as jest.Mocked<Repository<SpaceMediaRoleEntity>>;

		deviceRepository = {} as jest.Mocked<Repository<DeviceEntity>>;

		spacesService = {
			getOneOrThrow: jest.fn(),
			findDevicesBySpace: jest.fn(),
		} as unknown as jest.Mocked<SpacesService>;

		service = new SpaceMediaRoleService(roleRepository, deviceRepository, spacesService, new EventEmitter2());
	});

	it('reports hasOn=false when only ACTIVE is present on speaker channel', async () => {
		roleRepository.find.mockResolvedValue([]);
		spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as any);
		spacesService.findDevicesBySpace.mockResolvedValue([
			{
				id: 'device-1',
				name: 'Speaker',
				category: DeviceCategory.SPEAKER,
				channels: [
					{
						id: 'channel-1',
						name: 'Speaker Channel',
						category: ChannelCategory.SPEAKER,
						properties: [
							{ category: PropertyCategory.ACTIVE, value: true },
							{ category: PropertyCategory.VOLUME, value: 30 },
						],
					},
				],
			} as unknown as DeviceEntity,
		]);

		const targets = await service.getMediaTargetsInSpace('space-1');

		expect(targets).toHaveLength(1);
		expect(targets[0].hasOn).toBe(false);
		expect(targets[0].hasVolume).toBe(true);
	});
});
