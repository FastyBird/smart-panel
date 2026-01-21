import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { MediaMode } from '../spaces.constants';

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
		const device = {
			id: 'device-1',
			category: DeviceCategory.MEDIA,
			channels: [
				{
					id: 'channel-1',
					category: ChannelCategory.SPEAKER,
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
			status: 'completed_success' as any,
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
});
