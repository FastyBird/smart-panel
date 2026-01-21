import { Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceMediaRoleEntity } from '../entities/space-media-role.entity';
import { SpaceEntity } from '../entities/space.entity';
import { MediaRole } from '../spaces.constants';

import { MediaTargetEventPayload, SpaceMediaRoleService } from './space-media-role.service';
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

		deviceRepository = {
			findOne: jest.fn(),
		} as unknown as jest.Mocked<Repository<DeviceEntity>>;

		spacesService = {
			getOneOrThrow: jest.fn(),
			findDevicesBySpace: jest.fn(),
		} as unknown as jest.Mocked<SpacesService>;

		service = new SpaceMediaRoleService(roleRepository, deviceRepository, spacesService, new EventEmitter2());
	});

	describe('getMediaTargetsInSpace', () => {
		it('lists all media devices by category regardless of channels', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					name: 'Speaker',
					category: DeviceCategory.SPEAKER,
					channels: [], // No channels but still a media device
				} as unknown as DeviceEntity,
				{
					id: 'device-2',
					name: 'TV',
					category: DeviceCategory.TELEVISION,
					channels: [
						{
							id: 'channel-1',
							name: 'TV Channel',
							category: ChannelCategory.TELEVISION,
							properties: [{ category: PropertyCategory.ON, value: true }],
						},
					],
				} as unknown as DeviceEntity,
			]);

			const targets = await service.getMediaTargetsInSpace('space-1');

			expect(targets).toHaveLength(2);
			expect(targets[0].deviceId).toBe('device-1');
			expect(targets[0].deviceCategory).toBe(DeviceCategory.SPEAKER);
			expect(targets[1].deviceId).toBe('device-2');
			expect(targets[1].deviceCategory).toBe(DeviceCategory.TELEVISION);
		});

		it('reports hasOn=false when only ACTIVE is present on speaker channel', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
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
			expect(targets[0].deviceCategory).toBe(DeviceCategory.SPEAKER);
			expect(targets[0].hasOn).toBe(false); // SPEAKER channels don't contribute to hasOn
			expect(targets[0].hasVolume).toBe(true);
		});

		it('detects volume capabilities from TELEVISION channels', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					name: 'Smart TV',
					category: DeviceCategory.TELEVISION,
					channels: [
						{
							id: 'channel-1',
							name: 'TV Channel',
							category: ChannelCategory.TELEVISION,
							properties: [
								{ category: PropertyCategory.ON, value: true },
								{ category: PropertyCategory.VOLUME, value: 50 },
								{ category: PropertyCategory.MUTE, value: false },
							],
						},
					],
				} as unknown as DeviceEntity,
			]);

			const targets = await service.getMediaTargetsInSpace('space-1');

			expect(targets).toHaveLength(1);
			expect(targets[0].hasOn).toBe(true);
			expect(targets[0].hasVolume).toBe(true);
			expect(targets[0].hasMute).toBe(true);
		});
	});

	describe('inferDefaultMediaRoles', () => {
		it('assigns PRIMARY to first TV, SECONDARY to others', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'tv-1',
					name: 'Living Room TV',
					category: DeviceCategory.TELEVISION,
					channels: [],
				} as unknown as DeviceEntity,
				{
					id: 'tv-2',
					name: 'Bedroom TV',
					category: DeviceCategory.TELEVISION,
					channels: [],
				} as unknown as DeviceEntity,
			]);

			const roles = await service.inferDefaultMediaRoles('space-1');

			expect(roles).toHaveLength(2);
			expect(roles[0].role).toBe(MediaRole.PRIMARY);
			expect(roles[1].role).toBe(MediaRole.SECONDARY);
		});

		it('assigns BACKGROUND to speakers', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'speaker-1',
					name: 'Kitchen Speaker',
					category: DeviceCategory.SPEAKER,
					channels: [],
				} as unknown as DeviceEntity,
			]);

			const roles = await service.inferDefaultMediaRoles('space-1');

			expect(roles).toHaveLength(1);
			expect(roles[0].role).toBe(MediaRole.BACKGROUND);
		});

		it('assigns GAMING to game consoles', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'console-1',
					name: 'PlayStation',
					category: DeviceCategory.GAME_CONSOLE,
					channels: [],
				} as unknown as DeviceEntity,
			]);

			const roles = await service.inferDefaultMediaRoles('space-1');

			expect(roles).toHaveLength(1);
			expect(roles[0].role).toBe(MediaRole.GAMING);
		});

		it('assigns SECONDARY to AV receivers and set-top boxes', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'avr-1',
					name: 'AV Receiver',
					category: DeviceCategory.AV_RECEIVER,
					channels: [],
				} as unknown as DeviceEntity,
				{
					id: 'stb-1',
					name: 'Cable Box',
					category: DeviceCategory.SET_TOP_BOX,
					channels: [],
				} as unknown as DeviceEntity,
			]);

			const roles = await service.inferDefaultMediaRoles('space-1');

			expect(roles).toHaveLength(2);
			expect(roles[0].role).toBe(MediaRole.SECONDARY);
			expect(roles[1].role).toBe(MediaRole.SECONDARY);
		});

		it('assigns PRIMARY to projectors like TVs', async () => {
			roleRepository.find.mockResolvedValue([]);
			spacesService.getOneOrThrow.mockResolvedValue({ id: 'space-1' } as SpaceEntity);
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'projector-1',
					name: 'Home Theater Projector',
					category: DeviceCategory.PROJECTOR,
					channels: [],
				} as unknown as DeviceEntity,
			]);

			const roles = await service.inferDefaultMediaRoles('space-1');

			expect(roles).toHaveLength(1);
			expect(roles[0].role).toBe(MediaRole.PRIMARY);
		});
	});

	describe('buildMediaTargetEventPayload', () => {
		it('aggregates capabilities from all channels', async () => {
			deviceRepository.findOne.mockResolvedValue({
				id: 'device-1',
				name: 'Media Device',
				category: DeviceCategory.MEDIA,
				channels: [
					{
						id: 'tv-channel',
						name: 'TV Channel',
						category: ChannelCategory.TELEVISION,
						properties: [{ category: PropertyCategory.ON, value: true }],
					},
					{
						id: 'speaker-channel',
						name: 'Speaker Channel',
						category: ChannelCategory.SPEAKER,
						properties: [
							{ category: PropertyCategory.VOLUME, value: 30 },
							{ category: PropertyCategory.MUTE, value: false },
						],
					},
				],
			} as unknown as DeviceEntity);

			const payload = await (
				service as unknown as {
					buildMediaTargetEventPayload: (
						spaceId: string,
						deviceId: string,
						role: MediaRole | null,
						priority: number,
					) => Promise<MediaTargetEventPayload | null>;
				}
			).buildMediaTargetEventPayload('space-1', 'device-1', MediaRole.PRIMARY, 0);

			// Aggregated from all channels
			expect(payload.has_on).toBe(true); // From TV channel
			expect(payload.has_volume).toBe(true); // From speaker channel
			expect(payload.has_mute).toBe(true); // From speaker channel
			expect(payload.device_category).toBe(DeviceCategory.MEDIA);
			expect(payload.id).toBe('device-1'); // Device-level ID, no channel suffix
		});
	});
});
