import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { IntentStatus } from '../../intents/intents.constants';
import { SpaceMediaRoleEntity } from '../entities/space-media-role.entity';
import { MediaMode, MediaRole } from '../spaces.constants';

import { SpaceMediaStateService } from './space-media-state.service';

describe('SpaceMediaStateService', () => {
	const spacesService = {
		findOne: jest.fn(),
		findDevicesBySpace: jest.fn(),
	};
	const mediaRoleService = {
		getRoleMap: jest.fn(),
	};
	const intentTimeseriesService = {
		getLastMediaState: jest.fn(),
		storeMediaStateChange: jest.fn(),
	};

	let service: SpaceMediaStateService;

	beforeEach(() => {
		jest.resetAllMocks();
		service = new SpaceMediaStateService(
			spacesService as unknown as any,
			mediaRoleService as unknown as any,
			intentTimeseriesService as unknown as any,
		);
	});

	it('returns null when space is not found', async () => {
		spacesService.findOne.mockResolvedValue(null);

		const state = await service.getMediaState('missing');

		expect(state).toBeNull();
		expect(spacesService.findDevicesBySpace).not.toHaveBeenCalled();
	});

	it('returns aggregated state and uses persisted last applied mode', async () => {
		// Use a TELEVISION device with TELEVISION channel for proper power detection
		// (power is only detected from TELEVISION/SWITCHER channels)
		const device = {
			id: 'device-1',
			category: DeviceCategory.TELEVISION,
			channels: [
				{
					id: 'channel-1',
					category: ChannelCategory.TELEVISION,
					properties: [
						{ category: PropertyCategory.ON, value: true },
						{ category: PropertyCategory.VOLUME, value: 30 },
					],
				},
			],
		};

		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([device]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());
		intentTimeseriesService.getLastMediaState.mockResolvedValue({
			mode: MediaMode.BACKGROUND,
			volume: 30,
			muted: false,
			intentId: 'intent-1',
			appliedAt: new Date('2024-01-01T00:00:00Z'),
			status: IntentStatus.COMPLETED_SUCCESS,
			intentType: 'space.media.setMode',
		});

		const state = await service.getMediaState('space-1');

		expect(state?.totalDevices).toBe(1);
		expect(state?.devicesOn).toBe(1);
		expect(state?.lastAppliedMode).toBe(MediaMode.BACKGROUND);
		expect(state?.lastAppliedVolume).toBe(30);
		expect(state?.lastAppliedMuted).toBe(false);
		expect(intentTimeseriesService.getLastMediaState).toHaveBeenCalledWith('space-1');
	});

	describe('mode detection', () => {
		it('detects exact OFF mode match', async () => {
			const primaryRole = { deviceId: 'device-1', role: MediaRole.PRIMARY } as SpaceMediaRoleEntity;

			spacesService.findOne.mockResolvedValue({ id: 'space-1' });
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					category: DeviceCategory.TELEVISION,
					channels: [
						{
							id: 'channel-1',
							category: ChannelCategory.TELEVISION,
							properties: [{ category: PropertyCategory.ON, value: false }],
						},
					],
				},
			]);
			mediaRoleService.getRoleMap.mockResolvedValue(new Map([['device-1', primaryRole]]));
			intentTimeseriesService.getLastMediaState.mockResolvedValue(null);

			const state = await service.getMediaState('space-1');

			expect(state?.detectedMode).toBe(MediaMode.OFF);
			expect(state?.modeConfidence).toBe('exact');
			expect(state?.modeMatchPercentage).toBe(100);
		});

		it('detects FOCUSED mode with PRIMARY on at correct volume', async () => {
			// Test with a single PRIMARY TV that matches FOCUSED mode settings
			// FOCUSED mode for PRIMARY: { power: true, volume: 50, muted: false }
			const primaryRole = { deviceId: 'device-1', role: MediaRole.PRIMARY } as SpaceMediaRoleEntity;

			spacesService.findOne.mockResolvedValue({ id: 'space-1' });
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					category: DeviceCategory.TELEVISION,
					channels: [
						{
							id: 'channel-1',
							category: ChannelCategory.TELEVISION,
							properties: [
								{ category: PropertyCategory.ON, value: true },
								{ category: PropertyCategory.VOLUME, value: 50 },
								{ category: PropertyCategory.MUTE, value: false },
							],
						},
					],
				},
			]);
			mediaRoleService.getRoleMap.mockResolvedValue(new Map([['device-1', primaryRole]]));
			intentTimeseriesService.getLastMediaState.mockResolvedValue(null);

			const state = await service.getMediaState('space-1');

			expect(state?.detectedMode).toBe(MediaMode.FOCUSED);
			expect(state?.modeConfidence).toBe('exact');
		});

		it('detects approximate match when volume is within tolerance', async () => {
			const primaryRole = { deviceId: 'device-1', role: MediaRole.PRIMARY } as SpaceMediaRoleEntity;

			spacesService.findOne.mockResolvedValue({ id: 'space-1' });
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					category: DeviceCategory.TELEVISION,
					channels: [
						{
							id: 'channel-1',
							category: ChannelCategory.TELEVISION,
							properties: [
								{ category: PropertyCategory.ON, value: true },
								// FOCUSED mode expects 50, but we have 53 (within 5% tolerance)
								{ category: PropertyCategory.VOLUME, value: 53 },
								{ category: PropertyCategory.MUTE, value: false },
							],
						},
					],
				},
			]);
			mediaRoleService.getRoleMap.mockResolvedValue(new Map([['device-1', primaryRole]]));
			intentTimeseriesService.getLastMediaState.mockResolvedValue(null);

			const state = await service.getMediaState('space-1');

			// Should still detect FOCUSED mode with exact confidence because 53 is within tolerance of 50
			expect(state?.detectedMode).toBe(MediaMode.FOCUSED);
			expect(state?.modeConfidence).toBe('exact');
		});

		it('returns no mode match when state does not match any mode', async () => {
			const primaryRole = { deviceId: 'device-1', role: MediaRole.PRIMARY } as SpaceMediaRoleEntity;

			spacesService.findOne.mockResolvedValue({ id: 'space-1' });
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					category: DeviceCategory.TELEVISION,
					channels: [
						{
							id: 'channel-1',
							category: ChannelCategory.TELEVISION,
							properties: [
								{ category: PropertyCategory.ON, value: true },
								// Volume of 25 doesn't match any mode
								{ category: PropertyCategory.VOLUME, value: 25 },
								{ category: PropertyCategory.MUTE, value: false },
							],
						},
					],
				},
			]);
			mediaRoleService.getRoleMap.mockResolvedValue(new Map([['device-1', primaryRole]]));
			intentTimeseriesService.getLastMediaState.mockResolvedValue(null);

			const state = await service.getMediaState('space-1');

			expect(state?.detectedMode).toBeNull();
			expect(state?.modeConfidence).toBe('none');
		});

		it('skips unassigned devices in mode detection', async () => {
			spacesService.findOne.mockResolvedValue({ id: 'space-1' });
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					category: DeviceCategory.SPEAKER,
					channels: [
						{
							id: 'channel-1',
							category: ChannelCategory.SPEAKER,
							properties: [{ category: PropertyCategory.VOLUME, value: 75 }],
						},
					],
				},
			]);
			// Device has no role assigned
			mediaRoleService.getRoleMap.mockResolvedValue(new Map());
			intentTimeseriesService.getLastMediaState.mockResolvedValue(null);

			const state = await service.getMediaState('space-1');

			// No devices with roles, so no mode can be detected
			expect(state?.detectedMode).toBeNull();
			expect(state?.modeConfidence).toBe('none');
		});
	});

	describe('role aggregation', () => {
		it('aggregates state per role correctly', async () => {
			const bgRole1 = { deviceId: 'device-1', role: MediaRole.BACKGROUND } as SpaceMediaRoleEntity;
			const bgRole2 = { deviceId: 'device-2', role: MediaRole.BACKGROUND } as SpaceMediaRoleEntity;

			spacesService.findOne.mockResolvedValue({ id: 'space-1' });
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					category: DeviceCategory.SPEAKER,
					channels: [
						{
							id: 'channel-1',
							category: ChannelCategory.SPEAKER,
							properties: [
								{ category: PropertyCategory.VOLUME, value: 50 },
								{ category: PropertyCategory.MUTE, value: false },
							],
						},
					],
				},
				{
					id: 'device-2',
					category: DeviceCategory.SPEAKER,
					channels: [
						{
							id: 'channel-2',
							category: ChannelCategory.SPEAKER,
							properties: [
								{ category: PropertyCategory.VOLUME, value: 50 },
								{ category: PropertyCategory.MUTE, value: false },
							],
						},
					],
				},
			]);
			mediaRoleService.getRoleMap.mockResolvedValue(
				new Map([
					['device-1', bgRole1],
					['device-2', bgRole2],
				]),
			);
			intentTimeseriesService.getLastMediaState.mockResolvedValue(null);

			const state = await service.getMediaState('space-1');

			expect(state?.roles[MediaRole.BACKGROUND]).toBeDefined();
			expect(state?.roles[MediaRole.BACKGROUND]?.devicesCount).toBe(2);
			expect(state?.roles[MediaRole.BACKGROUND]?.volume).toBe(50); // Same volume, not mixed
			expect(state?.roles[MediaRole.BACKGROUND]?.isVolumeMixed).toBe(false);
		});

		it('marks volume as mixed when devices have different volumes', async () => {
			const bgRole1 = { deviceId: 'device-1', role: MediaRole.BACKGROUND } as SpaceMediaRoleEntity;
			const bgRole2 = { deviceId: 'device-2', role: MediaRole.BACKGROUND } as SpaceMediaRoleEntity;

			spacesService.findOne.mockResolvedValue({ id: 'space-1' });
			spacesService.findDevicesBySpace.mockResolvedValue([
				{
					id: 'device-1',
					category: DeviceCategory.SPEAKER,
					channels: [
						{
							id: 'channel-1',
							category: ChannelCategory.SPEAKER,
							properties: [{ category: PropertyCategory.VOLUME, value: 30 }],
						},
					],
				},
				{
					id: 'device-2',
					category: DeviceCategory.SPEAKER,
					channels: [
						{
							id: 'channel-2',
							category: ChannelCategory.SPEAKER,
							properties: [{ category: PropertyCategory.VOLUME, value: 70 }],
						},
					],
				},
			]);
			mediaRoleService.getRoleMap.mockResolvedValue(
				new Map([
					['device-1', bgRole1],
					['device-2', bgRole2],
				]),
			);
			intentTimeseriesService.getLastMediaState.mockResolvedValue(null);

			const state = await service.getMediaState('space-1');

			expect(state?.roles[MediaRole.BACKGROUND]?.isVolumeMixed).toBe(true);
			expect(state?.roles[MediaRole.BACKGROUND]?.volume).toBeNull();
		});
	});
});
