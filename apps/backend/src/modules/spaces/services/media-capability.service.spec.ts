import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PermissionType, PropertyCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { MediaCapabilityPermission, MediaEndpointType } from '../spaces.constants';

import { MediaCapabilityService } from './media-capability.service';
import { SpacesService } from './spaces.service';

function buildDevice(overrides: Record<string, unknown> = {}): Partial<DeviceEntity> {
	return {
		id: (overrides.id as string) ?? uuid(),
		name: (overrides.name as string) ?? 'Test Device',
		category: (overrides.category as string) ?? DeviceCategory.TELEVISION,
		status: (overrides.status as { online: boolean }) ?? { online: true },
		channels: (overrides.channels as DeviceEntity['channels']) ?? [],
	} as Partial<DeviceEntity>;
}

function buildChannel(category: string, properties: Array<{ category: string; permissions?: PermissionType[] }> = []) {
	return {
		id: uuid(),
		category,
		properties: properties.map((p) => ({
			id: uuid(),
			category: p.category,
			permissions: p.permissions ?? [PermissionType.READ_WRITE],
		})),
	};
}

describe('MediaCapabilityService', () => {
	let service: MediaCapabilityService;
	let mockSpacesService: {
		getOneOrThrow: jest.Mock;
		findDevicesBySpace: jest.Mock;
	};

	const spaceId = uuid();

	beforeEach(async () => {
		mockSpacesService = {
			getOneOrThrow: jest.fn().mockResolvedValue({ id: spaceId }),
			findDevicesBySpace: jest.fn().mockResolvedValue([]),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [MediaCapabilityService, { provide: SpacesService, useValue: mockSpacesService }],
		}).compile();

		service = module.get<MediaCapabilityService>(MediaCapabilityService);
	});

	describe('capability detection', () => {
		it('should detect power from television channel with ON property', async () => {
			const device = buildDevice({
				category: DeviceCategory.TELEVISION,
				channels: [buildChannel(ChannelCategory.TELEVISION, [{ category: PropertyCategory.ON }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].power).toBeDefined();
			expect(result[0].power?.permission).toBe(MediaCapabilityPermission.READ_WRITE);
		});

		it('should detect power from switcher channel with ACTIVE property', async () => {
			const device = buildDevice({
				category: DeviceCategory.TELEVISION,
				channels: [buildChannel(ChannelCategory.SWITCHER, [{ category: PropertyCategory.ACTIVE }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].power).toBeDefined();
		});

		it('should detect volume and mute from speaker channel', async () => {
			const device = buildDevice({
				category: DeviceCategory.SPEAKER,
				channels: [
					buildChannel(ChannelCategory.SPEAKER, [
						{ category: PropertyCategory.VOLUME },
						{ category: PropertyCategory.MUTE },
					]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].volume).toBeDefined();
			expect(result[0].mute).toBeDefined();
		});

		it('should detect playback and playbackState from media playback channel', async () => {
			const device = buildDevice({
				category: DeviceCategory.STREAMING_SERVICE,
				channels: [
					buildChannel(ChannelCategory.MEDIA_PLAYBACK, [
						{ category: PropertyCategory.COMMAND },
						{ category: PropertyCategory.STATUS },
					]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].playback).toBeDefined();
			expect(result[0].playbackState).toBeDefined();
		});

		it('should detect position and duration from media playback channel', async () => {
			const device = buildDevice({
				category: DeviceCategory.STREAMING_SERVICE,
				channels: [
					buildChannel(ChannelCategory.MEDIA_PLAYBACK, [
						{ category: PropertyCategory.COMMAND },
						{ category: PropertyCategory.POSITION },
						{ category: PropertyCategory.DURATION },
					]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].position).toBeDefined();
			expect(result[0].duration).toBeDefined();
		});

		it('should detect track, album, artist from media playback channel', async () => {
			const device = buildDevice({
				category: DeviceCategory.STREAMING_SERVICE,
				channels: [
					buildChannel(ChannelCategory.MEDIA_PLAYBACK, [
						{ category: PropertyCategory.COMMAND },
						{ category: PropertyCategory.TRACK },
						{ category: PropertyCategory.ALBUM },
						{ category: PropertyCategory.ARTIST },
					]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].trackMetadata).toBeDefined();
			expect(result[0].album).toBeDefined();
			expect(result[0].artist).toBeDefined();
		});

		it('should detect input from television channel with SOURCE property', async () => {
			const device = buildDevice({
				category: DeviceCategory.TELEVISION,
				channels: [buildChannel(ChannelCategory.TELEVISION, [{ category: PropertyCategory.SOURCE }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].input).toBeDefined();
		});

		it('should detect input from media input channel with SOURCE property', async () => {
			const device = buildDevice({
				category: DeviceCategory.AV_RECEIVER,
				channels: [buildChannel(ChannelCategory.MEDIA_INPUT, [{ category: PropertyCategory.SOURCE }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].input).toBeDefined();
		});

		it('should detect remote from television channel with REMOTE_KEY property', async () => {
			const device = buildDevice({
				category: DeviceCategory.TELEVISION,
				channels: [buildChannel(ChannelCategory.TELEVISION, [{ category: PropertyCategory.REMOTE_KEY }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].remote).toBeDefined();
		});

		it('should return empty for non-media device category', async () => {
			const device = buildDevice({
				category: 'thermostat',
				channels: [buildChannel(ChannelCategory.TELEVISION, [{ category: PropertyCategory.ON }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(0);
		});

		it('should return empty for media device with no media channels', async () => {
			const device = buildDevice({
				category: DeviceCategory.TELEVISION,
				channels: [],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(0);
		});
	});

	describe('suggestEndpointTypes', () => {
		it('should suggest display + audio_output + remote_target for TV with volume and remote', async () => {
			const device = buildDevice({
				category: DeviceCategory.TELEVISION,
				channels: [
					buildChannel(ChannelCategory.TELEVISION, [
						{ category: PropertyCategory.ON },
						{ category: PropertyCategory.REMOTE_KEY },
					]),
					buildChannel(ChannelCategory.SPEAKER, [{ category: PropertyCategory.VOLUME }]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.DISPLAY);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.AUDIO_OUTPUT);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.REMOTE_TARGET);
		});

		it('should suggest audio_output for speaker', async () => {
			const device = buildDevice({
				category: DeviceCategory.SPEAKER,
				channels: [buildChannel(ChannelCategory.SPEAKER, [{ category: PropertyCategory.VOLUME }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].suggestedEndpointTypes).toEqual([MediaEndpointType.AUDIO_OUTPUT]);
		});

		it('should suggest audio_output + source for receiver with input', async () => {
			const device = buildDevice({
				category: DeviceCategory.AV_RECEIVER,
				channels: [
					buildChannel(ChannelCategory.SPEAKER, [{ category: PropertyCategory.VOLUME }]),
					buildChannel(ChannelCategory.MEDIA_INPUT, [{ category: PropertyCategory.SOURCE }]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.AUDIO_OUTPUT);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.SOURCE);
		});

		it('should suggest source for streamer', async () => {
			const device = buildDevice({
				category: DeviceCategory.STREAMING_SERVICE,
				channels: [buildChannel(ChannelCategory.MEDIA_PLAYBACK, [{ category: PropertyCategory.COMMAND }])],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.SOURCE);
		});

		it('should suggest source + remote_target for streamer with remote', async () => {
			const device = buildDevice({
				category: DeviceCategory.STREAMING_SERVICE,
				channels: [
					buildChannel(ChannelCategory.MEDIA_PLAYBACK, [{ category: PropertyCategory.COMMAND }]),
					buildChannel(ChannelCategory.TELEVISION, [{ category: PropertyCategory.REMOTE_KEY }]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result).toHaveLength(1);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.SOURCE);
			expect(result[0].suggestedEndpointTypes).toContain(MediaEndpointType.REMOTE_TARGET);
		});
	});

	describe('permission mapping', () => {
		it('should map READ_WRITE permissions correctly', async () => {
			const device = buildDevice({
				category: DeviceCategory.SPEAKER,
				channels: [
					buildChannel(ChannelCategory.SPEAKER, [
						{ category: PropertyCategory.VOLUME, permissions: [PermissionType.READ_WRITE] },
					]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result[0].volume?.permission).toBe(MediaCapabilityPermission.READ_WRITE);
		});

		it('should map READ_ONLY permissions correctly', async () => {
			const device = buildDevice({
				category: DeviceCategory.SPEAKER,
				channels: [
					buildChannel(ChannelCategory.SPEAKER, [
						{ category: PropertyCategory.VOLUME, permissions: [PermissionType.READ_ONLY] },
					]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result[0].volume?.permission).toBe(MediaCapabilityPermission.READ);
		});

		it('should map WRITE_ONLY permissions correctly', async () => {
			const device = buildDevice({
				category: DeviceCategory.SPEAKER,
				channels: [
					buildChannel(ChannelCategory.SPEAKER, [
						{ category: PropertyCategory.VOLUME, permissions: [PermissionType.WRITE_ONLY] },
					]),
				],
			});
			mockSpacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getMediaCapabilitiesInSpace(spaceId);

			expect(result[0].volume?.permission).toBe(MediaCapabilityPermission.WRITE);
		});
	});
});
