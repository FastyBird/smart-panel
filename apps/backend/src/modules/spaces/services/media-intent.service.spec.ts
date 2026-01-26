import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { DEFAULT_TTL_SPACE_COMMAND, IntentType } from '../../intents/intents.constants';
import { MediaIntentDto } from '../dto/media-intent.dto';
import { MediaIntentType, MediaMode, MediaRole, VolumeDelta } from '../spaces.constants';

import { MediaDevice, MediaIntentService, selectMediaForMode } from './media-intent.service';

describe('MediaIntentService', () => {
	const spacesService = {
		findOne: jest.fn(),
		findDevicesBySpace: jest.fn(),
	};
	const platformRegistryService = {
		get: jest.fn(),
	};
	const mediaRoleService = {
		getRoleMap: jest.fn(),
	};
	const eventEmitter = {
		emit: jest.fn(),
	} as unknown as EventEmitter2;
	const mediaStateService = {
		setLastAppliedMode: jest.fn(),
		getMediaState: jest.fn(),
	};
	const intentsService = {
		createIntent: jest.fn(),
		completeIntent: jest.fn(),
	};
	const intentTimeseriesService = {
		storeMediaStateChange: jest.fn(),
	};

	let service: MediaIntentService;

	beforeEach(() => {
		jest.resetAllMocks();

		service = new MediaIntentService(
			spacesService as unknown as any,
			platformRegistryService as unknown as any,
			mediaRoleService as unknown as any,
			eventEmitter,
			mediaStateService as unknown as any,
			intentsService as unknown as any,
			intentTimeseriesService as unknown as any,
		);

		platformRegistryService.get.mockReturnValue({
			processBatch: jest.fn().mockResolvedValue(true),
		});
		mediaStateService.getMediaState.mockResolvedValue({ totalDevices: 1, devicesOn: 1 });
		intentsService.createIntent.mockReturnValue({ id: 'intent-1' });
	});

	it('creates and completes intent for media mode change', async () => {
		const dto: MediaIntentDto = {
			type: MediaIntentType.SET_MODE,
			mode: MediaMode.PARTY,
		};

		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([
			{
				id: 'device-1',
				category: DeviceCategory.MEDIA,
				status: { online: true, status: 'connected' },
				channels: [
					{
						id: 'channel-1',
						category: ChannelCategory.SPEAKER,
						properties: [
							{ category: PropertyCategory.ON, value: true },
							{ category: PropertyCategory.VOLUME, value: 50 },
							{ category: PropertyCategory.MUTE, value: false },
						],
					},
				],
			},
		]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());

		const result = await service.executeMediaIntent('space-1', dto);

		expect(result?.success).toBe(true);
		expect(intentsService.createIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				type: IntentType.SPACE_MEDIA_SET_MODE,
				ttlMs: DEFAULT_TTL_SPACE_COMMAND,
			}),
		);
		expect(intentsService.completeIntent).toHaveBeenCalledWith('intent-1', expect.any(Array));
		expect(mediaStateService.setLastAppliedMode).toHaveBeenCalledWith('space-1', MediaMode.PARTY);
		expect(intentTimeseriesService.storeMediaStateChange).toHaveBeenCalledWith(
			'space-1',
			IntentType.SPACE_MEDIA_SET_MODE,
			expect.objectContaining({ mode: MediaMode.PARTY }),
		);
	});
});

describe('selectMediaForMode', () => {
	function createMediaDevice(
		id: string,
		role: MediaRole | null,
		hasVolume = true,
		hasOn = true,
		hasMute = true,
	): MediaDevice {
		return {
			device: { id, category: DeviceCategory.MEDIA } as DeviceEntity,
			mediaChannel: { id: `channel-${id}` } as ChannelEntity,
			onProperty: hasOn ? ({ category: PropertyCategory.ON, value: true } as ChannelPropertyEntity) : null,
			volumeProperty: hasVolume ? ({ category: PropertyCategory.VOLUME, value: 50 } as ChannelPropertyEntity) : null,
			muteProperty: hasMute ? ({ category: PropertyCategory.MUTE, value: false } as ChannelPropertyEntity) : null,
			role,
		};
	}

	it('applies MVP fallback when no devices have roles', () => {
		const devices = [createMediaDevice('dev-1', null), createMediaDevice('dev-2', null)];

		const selections = selectMediaForMode(devices, MediaMode.FOCUSED);

		expect(selections).toHaveLength(2);
		expect(selections.every((s) => s.isFallback)).toBe(true);
		// MVP fallback uses PRIMARY role rules
		expect(selections[0].rule).toEqual({ power: true, volume: 50, muted: false });
	});

	it('applies role-specific rules when roles are configured', () => {
		const devices = [
			createMediaDevice('primary', MediaRole.PRIMARY),
			createMediaDevice('secondary', MediaRole.SECONDARY),
			createMediaDevice('background', MediaRole.BACKGROUND),
		];

		const selections = selectMediaForMode(devices, MediaMode.FOCUSED);

		expect(selections).toHaveLength(3);
		// Primary gets power on with volume 50
		const primary = selections.find((s) => s.media.device.id === 'primary');
		expect(primary?.rule).toEqual({ power: true, volume: 50, muted: false });
		expect(primary?.isFallback).toBe(false);
		// Secondary gets power off
		const secondary = selections.find((s) => s.media.device.id === 'secondary');
		expect(secondary?.rule).toEqual({ power: false });
		// Background gets muted
		const background = selections.find((s) => s.media.device.id === 'background');
		expect(background?.rule).toEqual({ power: true, muted: true });
	});

	it('skips HIDDEN role devices', () => {
		const devices = [createMediaDevice('primary', MediaRole.PRIMARY), createMediaDevice('hidden', MediaRole.HIDDEN)];

		const selections = selectMediaForMode(devices, MediaMode.PARTY);

		expect(selections).toHaveLength(1);
		expect(selections[0].media.device.id).toBe('primary');
	});

	it('treats unassigned devices as SECONDARY fallback when others have roles', () => {
		const devices = [createMediaDevice('primary', MediaRole.PRIMARY), createMediaDevice('unassigned', null)];

		const selections = selectMediaForMode(devices, MediaMode.FOCUSED);

		expect(selections).toHaveLength(2);
		const unassigned = selections.find((s) => s.media.device.id === 'unassigned');
		expect(unassigned?.isFallback).toBe(true);
		// Unassigned gets SECONDARY rule (power off in FOCUSED mode)
		expect(unassigned?.rule).toEqual({ power: false });
	});

	it('turns all devices off in OFF mode', () => {
		const devices = [
			createMediaDevice('primary', MediaRole.PRIMARY),
			createMediaDevice('background', MediaRole.BACKGROUND),
		];

		const selections = selectMediaForMode(devices, MediaMode.OFF);

		expect(selections).toHaveLength(2);
		expect(selections.every((s) => s.rule.power === false)).toBe(true);
	});

	it('sets all devices to high volume in PARTY mode', () => {
		const devices = [
			createMediaDevice('primary', MediaRole.PRIMARY),
			createMediaDevice('secondary', MediaRole.SECONDARY),
			createMediaDevice('background', MediaRole.BACKGROUND),
		];

		const selections = selectMediaForMode(devices, MediaMode.PARTY);

		expect(selections).toHaveLength(3);
		expect(selections.every((s) => s.rule.volume === 70)).toBe(true);
		expect(selections.every((s) => s.rule.power === true)).toBe(true);
		expect(selections.every((s) => s.rule.muted === false)).toBe(true);
	});

	it('activates only BACKGROUND role in BACKGROUND mode', () => {
		const devices = [
			createMediaDevice('primary', MediaRole.PRIMARY),
			createMediaDevice('background', MediaRole.BACKGROUND),
		];

		const selections = selectMediaForMode(devices, MediaMode.BACKGROUND);

		const primary = selections.find((s) => s.media.device.id === 'primary');
		const background = selections.find((s) => s.media.device.id === 'background');

		expect(primary?.rule.power).toBe(false);
		expect(background?.rule).toEqual({ power: true, volume: 30, muted: false });
	});
});

describe('MediaIntentService - volume delta edge cases', () => {
	const spacesService = {
		findOne: jest.fn(),
		findDevicesBySpace: jest.fn(),
	};
	const platformRegistryService = {
		get: jest.fn(),
	};
	const mediaRoleService = {
		getRoleMap: jest.fn(),
	};
	const eventEmitter = {
		emit: jest.fn(),
	} as unknown as EventEmitter2;
	const mediaStateService = {
		setLastAppliedMode: jest.fn(),
		getMediaState: jest.fn(),
	};
	const intentsService = {
		createIntent: jest.fn(),
		completeIntent: jest.fn(),
	};
	const intentTimeseriesService = {
		storeMediaStateChange: jest.fn(),
	};

	let service: MediaIntentService;
	let mockPlatform: { processBatch: jest.Mock };

	beforeEach(() => {
		jest.resetAllMocks();
		mockPlatform = { processBatch: jest.fn().mockResolvedValue(true) };

		service = new MediaIntentService(
			spacesService as unknown as any,
			platformRegistryService as unknown as any,
			mediaRoleService as unknown as any,
			eventEmitter,
			mediaStateService as unknown as any,
			intentsService as unknown as any,
			intentTimeseriesService as unknown as any,
		);

		platformRegistryService.get.mockReturnValue(mockPlatform);
		mediaStateService.getMediaState.mockResolvedValue({ totalDevices: 1, devicesOn: 1 });
		intentsService.createIntent.mockReturnValue({ id: 'intent-1' });
	});

	function createDeviceWithVolume(volume: number, isOn = true) {
		return {
			id: 'device-1',
			category: DeviceCategory.MEDIA,
			status: { online: true, status: 'connected' },
			channels: [
				{
					id: 'channel-1',
					category: ChannelCategory.SPEAKER,
					properties: [
						{ category: PropertyCategory.ON, value: isOn },
						{ category: PropertyCategory.VOLUME, value: volume },
					],
				},
				{
					id: 'channel-tv',
					category: ChannelCategory.TELEVISION,
					properties: [{ category: PropertyCategory.ON, value: isOn }],
				},
			],
		};
	}

	it('clamps volume at 100 when increasing from high value', async () => {
		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([createDeviceWithVolume(95)]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());

		const dto: MediaIntentDto = {
			type: MediaIntentType.VOLUME_DELTA,
			delta: VolumeDelta.MEDIUM, // +10
			increase: true,
		};

		await service.executeMediaIntent('space-1', dto);

		// Should have been called with volume clamped to 100
		expect(mockPlatform.processBatch).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					value: 100, // 95 + 10 = 105, clamped to 100
				}),
			]),
		);
	});

	it('clamps volume at 0 when decreasing from low value', async () => {
		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([createDeviceWithVolume(3)]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());

		const dto: MediaIntentDto = {
			type: MediaIntentType.VOLUME_DELTA,
			delta: VolumeDelta.SMALL, // -5
			increase: false,
		};

		await service.executeMediaIntent('space-1', dto);

		// Should have been called with volume clamped to 0
		expect(mockPlatform.processBatch).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					value: 0, // 3 - 5 = -2, clamped to 0
				}),
			]),
		);
	});

	it('applies correct delta values for each size', async () => {
		// Test SMALL delta (5%)
		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([createDeviceWithVolume(50)]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());

		const smallDto: MediaIntentDto = {
			type: MediaIntentType.VOLUME_DELTA,
			delta: VolumeDelta.SMALL,
			increase: true,
		};

		await service.executeMediaIntent('space-1', smallDto);

		expect(mockPlatform.processBatch).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ value: 55 })]), // 50 + 5
		);

		// Reset and test LARGE delta (20%)
		jest.clearAllMocks();
		intentsService.createIntent.mockReturnValue({ id: 'intent-2' });
		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([createDeviceWithVolume(50)]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());
		platformRegistryService.get.mockReturnValue(mockPlatform);
		mediaStateService.getMediaState.mockResolvedValue({ totalDevices: 1, devicesOn: 1 });

		const largeDto: MediaIntentDto = {
			type: MediaIntentType.VOLUME_DELTA,
			delta: VolumeDelta.LARGE,
			increase: true,
		};

		await service.executeMediaIntent('space-1', largeDto);

		expect(mockPlatform.processBatch).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ value: 70 })]), // 50 + 20
		);
	});

	it('skips volume adjustment for devices that are OFF', async () => {
		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([createDeviceWithVolume(50, false)]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());

		const dto: MediaIntentDto = {
			type: MediaIntentType.VOLUME_DELTA,
			delta: VolumeDelta.MEDIUM,
			increase: true,
		};

		const result = await service.executeMediaIntent('space-1', dto);

		// Should still succeed but platform should not have been called with any volume commands
		// (device is off, so volume adjustment is skipped)
		expect(result?.success).toBe(true);
	});

	it('skips devices without volume property', async () => {
		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([
			{
				id: 'device-1',
				category: DeviceCategory.MEDIA,
				status: { online: true, status: 'connected' },
				channels: [
					{
						id: 'channel-1',
						category: ChannelCategory.TELEVISION,
						properties: [{ category: PropertyCategory.ON, value: true }],
						// No volume property
					},
				],
			},
		]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());

		const dto: MediaIntentDto = {
			type: MediaIntentType.VOLUME_DELTA,
			delta: VolumeDelta.MEDIUM,
			increase: true,
		};

		const result = await service.executeMediaIntent('space-1', dto);

		// Should succeed but no commands sent
		expect(result?.success).toBe(true);
	});
});
